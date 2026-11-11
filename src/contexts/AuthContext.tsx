import { useCallback, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage, logApplicationError } from "@/lib/errorLogging";
import { resolveEffectiveRole, type AppRole } from "@/lib/permissions";
import {
  clearLastActivity,
  isInactivityExpired,
  markLoginAttemptActivity,
  useAuthInactivity,
} from "@/hooks/useAuthInactivity";
import { AuthContext, type AuthContextType } from "@/contexts/authContextValue";

const ROLE_REQUEST_TIMEOUT_MS = 10_000;
const MISSING_PROFILE_MESSAGE = "Sua conta não possui um perfil de acesso. Contate o responsável pelo sistema.";
const UNCONFIRMED_SESSION_MESSAGE = "Não foi possível confirmar sua sessão. Tente novamente.";

// Mesmo formato de chave usado pelo cliente Supabase (`sb-<ref>-auth-token`).
const AUTH_STORAGE_KEY = `sb-${new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split(".")[0]}-auth-token`;

function removePersistedAuthSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(`${AUTH_STORAGE_KEY}-code-verifier`);
  localStorage.removeItem(`${AUTH_STORAGE_KEY}-user`);
}

class MissingProfileError extends Error {
  constructor() {
    super(MISSING_PROFILE_MESSAGE);
    this.name = "MissingProfileError";
  }
}

/** Erros que indicam que a sessão não vale mais — não adianta manter o papel em cache. */
function isPermanentRoleError(error: unknown) {
  if (error instanceof MissingProfileError) return true;
  if (!error || typeof error !== "object") return false;
  const record = error as { status?: unknown; code?: unknown; message?: unknown };
  const status = Number(record.status);
  if (status === 401 || status === 403) return true;

  const code = String(record.code || "").toUpperCase();
  const message = String(record.message || "").toLowerCase();
  return code === "PGRST301" || /\b(jwt|token)\b.*\b(expir|inválid|invalid|malformed)\b/.test(message);
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

async function requestUserRole(userId: string): Promise<AppRole> {
  const timeoutController = new AbortController();
  const timeoutId = window.setTimeout(() => timeoutController.abort(), ROLE_REQUEST_TIMEOUT_MS);
  try {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .abortSignal(timeoutController.signal);
    if (error) throw error;

    const role = resolveEffectiveRole(data?.map(({ role }) => role) ?? []);
    if (!role) throw new MissingProfileError();
    return role;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  // Identifica o evento de auth vigente. Respostas de consultas iniciadas por
  // um evento anterior (ex.: SIGNED_IN de outra conta logo após SIGNED_OUT)
  // são descartadas para não sobrescrever o papel da conta correta.
  const authEventIdRef = useRef(0);
  const activeUserIdRef = useRef<string | null>(null);
  const activeSessionRef = useRef<Session | null>(null);
  const userRoleRef = useRef<AppRole | null>(null);
  const signingOutRef = useRef(false);
  const signOutOperationIdRef = useRef(0);
  const roleRequestRef = useRef<{ userId: string; promise: Promise<void> } | null>(null);

  const clearAuthState = useCallback(() => {
    ++authEventIdRef.current;
    activeUserIdRef.current = null;
    activeSessionRef.current = null;
    userRoleRef.current = null;
    roleRequestRef.current = null;
    queryClient.clear();
    setUser(null);
    setSession(null);
    setUserRole(null);
    setAuthError(null);
    setIsLoading(false);
  }, [queryClient]);

  const signOut = useCallback(async () => {
    if (signingOutRef.current) return;

    const operationId = ++signOutOperationIdRef.current;
    const accessToken = activeSessionRef.current?.access_token;
    signingOutRef.current = true;
    // Bloqueia esta e as outras abas antes da revogação remota, que pode demorar.
    clearAuthState();
    clearLastActivity();
    removePersistedAuthSession();

    try {
      // Revoga somente esta sessão. O escopo global permitiria que um logout
      // antigo anulasse um login novo da mesma conta.
      if (accessToken) {
        const { error } = await supabase.auth.admin.signOut(accessToken, "local");
        if (error) throw error;
      }
    } catch (error) {
      void logApplicationError(error, {
        location: "AuthContext.signOut", operation: "auth", entity: "session",
      });
    } finally {
      if (signOutOperationIdRef.current === operationId) signingOutRef.current = false;
    }
  }, [clearAuthState]);

  const fetchUserRole = useCallback(async (userId: string, eventId: number) => {
    const isCurrentEvent = () => authEventIdRef.current === eventId;
    try {
      const role = await requestUserRole(userId);
      if (!isCurrentEvent()) return;
      // Mudança de papel invalida dados carregados com as permissões antigas.
      if (userRoleRef.current && userRoleRef.current !== role) queryClient.clear();
      userRoleRef.current = role;
      setUserRole(role);
      setAuthError(null);
    } catch (error) {
      if (!isCurrentEvent()) return;
      void logApplicationError(error, {
        location: "AuthContext.fetchUserRole",
        operation: "read",
        entity: "user_roles",
        entityId: userId,
      });
      // Falha transitória (rede, timeout) ao revalidar não pode expulsar quem já
      // tem papel conhecido: a tela de erro desmontaria o formulário em edição.
      if (userRoleRef.current && !isPermanentRoleError(error)) return;
      queryClient.clear();
      userRoleRef.current = null;
      setUserRole(null);
      setAuthError(getErrorMessage(error));
    }
  }, [queryClient]);

  const retryUserRole = useCallback(async () => {
    const userId = activeUserIdRef.current;
    if (!userId || signingOutRef.current) return;
    if (roleRequestRef.current?.userId === userId) return roleRequestRef.current.promise;

    const eventId = ++authEventIdRef.current;
    if (!userRoleRef.current) setIsLoading(true);
    const promise = fetchUserRole(userId, eventId).finally(() => {
      if (authEventIdRef.current !== eventId) return;
      roleRequestRef.current = null;
      setIsLoading(false);
    });
    roleRequestRef.current = { userId, promise };
    return promise;
  }, [fetchUserRole]);

  // Ponto único de transição de autenticação, usado pelo listener do Supabase
  // e pelo retorno do login (o listener é assíncrono; confirmar aqui a sessão
  // devolvida evita que a tela volte ao formulário antes do evento chegar).
  const synchronizeAuthState = useCallback((nextSession: Session | null) => {
    if (signingOutRef.current && nextSession) return;
    if (!nextSession) {
      clearAuthState();
      return;
    }

    // Guardada antes da checagem para que o logout por inatividade revogue
    // também a sessão restaurada do armazenamento.
    activeSessionRef.current = nextSession;
    if (isInactivityExpired()) {
      // Nunca aguarda outra chamada Supabase dentro do listener de auth.
      void signOut();
      return;
    }

    setSession(nextSession);
    const nextUserId = nextSession.user.id;
    // SIGNED_IN repetido e TOKEN_REFRESHED não desmontam a página atual.
    if (activeUserIdRef.current === nextUserId) return;

    ++authEventIdRef.current;
    queryClient.clear();
    activeUserIdRef.current = nextUserId;
    userRoleRef.current = null;
    setIsLoading(true);
    setUser(nextSession.user);
    setUserRole(null);
    setAuthError(null);
    setTimeout(() => void retryUserRole(), 0);
  }, [clearAuthState, retryUserRole, queryClient, signOut]);

  useEffect(() => {
    // INITIAL_SESSION é emitido logo após o subscribe e cobre a verificação
    // inicial. Não chame getSession() em paralelo: se resolvesse depois de um
    // SIGNED_IN, sobrescreveria o estado com a sessão antiga.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      synchronizeAuthState(nextSession);
      // Renovação de token também revalida o papel (pode ter sido alterado).
      if (event === "TOKEN_REFRESHED" && nextSession) setTimeout(() => void retryUserRole(), 0);
    });

    // O logout remove o token sem passar pelo cliente Supabase; as outras abas
    // percebem pela remoção no localStorage (`key === null` é um clear()).
    const handleAuthStorage = (event: StorageEvent) => {
      const tokenRemoved = event.key === AUTH_STORAGE_KEY && event.newValue === null;
      if (tokenRemoved || event.key === null) synchronizeAuthState(null);
    };
    window.addEventListener("storage", handleAuthStorage);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("storage", handleAuthStorage);
    };
  }, [synchronizeAuthState, retryUserRole]);

  useEffect(() => {
    const revalidate = () => {
      if (document.visibilityState === "hidden" || !activeUserIdRef.current) return;
      if (isInactivityExpired()) {
        void signOut();
        return;
      }
      void retryUserRole();
    };
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", revalidate);
    return () => {
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", revalidate);
    };
  }, [retryUserRole, signOut]);

  const signIn = useCallback(async (email: string, password: string) => {
    // Login novo não deve ficar bloqueado por revogação remota de sessão antiga.
    ++signOutOperationIdRef.current;
    signingOutRef.current = false;
    const undoLoginActivity = markLoginAttemptActivity();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error && data.session) {
        synchronizeAuthState(data.session);
        return { error: null };
      }
      undoLoginActivity();
      return { error: error ?? new Error(UNCONFIRMED_SESSION_MESSAGE) };
    } catch (error) {
      undoLoginActivity();
      return { error: toError(error) };
    }
  }, [synchronizeAuthState]);

  useAuthInactivity(user, signOut);

  const value = useMemo<AuthContextType>(() => ({
    user,
    session,
    isAuthenticated: !!user,
    isLoading,
    authError,
    retryUserRole,
    userRole,
    isEditor: userRole === "editor",
    isAssistant: userRole === "assistant",
    signIn,
    signOut,
  }), [user, session, isLoading, authError, retryUserRole, userRole, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
