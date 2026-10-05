import { createContext, useCallback, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { getErrorMessage, logApplicationError } from "@/lib/errorLogging";
import { useQueryClient } from "@tanstack/react-query";

type AppRole = "viewer" | "editor" | "assistant";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  retryUserRole: () => Promise<void>;
  userRole: AppRole | null;
  isEditor: boolean;
  isAssistant: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const LAST_ACTIVITY_STORAGE_KEY = "assistencia-nsm-last-activity";
const AUTH_STORAGE_KEY = `sb-${new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];

function removePersistedAuthSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(`${AUTH_STORAGE_KEY}-code-verifier`);
  localStorage.removeItem(`${AUTH_STORAGE_KEY}-user`);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  // Descarta uma resposta de fetchUserRole desatualizada quando um segundo
  // evento de auth (ex.: SIGNED_IN de outra conta logo após um SIGNED_OUT)
  // chega antes da primeira consulta terminar.
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
    // Bloqueia esta e outras abas antes da revogação remota, que pode demorar.
    clearAuthState();
    localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
    removePersistedAuthSession();

    try {
      // Revoga somente esta sessão. Usar o escopo global permitiria que uma
      // requisição de logout antiga anulasse um login novo da mesma conta.
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

  // Fetch user role from database. `eventId` identifica o evento de auth que
  // disparou esta busca; se um evento mais novo já assumiu o estado antes da
  // consulta terminar, o resultado é descartado para não sobrescrever o papel
  // da conta correta com o de uma consulta desatualizada.
  const fetchUserRole = useCallback(async (userId: string, eventId: number) => {
    const applyRole = (role: AppRole) => {
      if (authEventIdRef.current !== eventId) return;
      if (userRoleRef.current && userRoleRef.current !== role) queryClient.clear();
      userRoleRef.current = role;
      setUserRole(role);
      setAuthError(null);
    };

    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .abortSignal(AbortSignal.timeout(10000));

      if (error) {
        throw error;
      }

      // Dados anteriores à restrição de um papel por conta podem conter mais
      // de uma linha. A precedência coincide com as permissões do banco.
      const roles = new Set(data?.map(({ role }) => role) ?? []);
      if (!roles.size) throw new Error("Sua conta não possui um perfil de acesso. Contate o responsável pelo sistema.");
      applyRole(roles.has("editor") ? "editor" : roles.has("assistant") ? "assistant" : "viewer");
    } catch (err) {
      if (authEventIdRef.current !== eventId) return;
      userRoleRef.current = null;
      setUserRole(null);
      setAuthError(getErrorMessage(err));
      void logApplicationError(err, {
        location: "AuthContext.fetchUserRole",
        operation: "read",
        entity: "user_roles",
        entityId: userId,
      });
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

  // Centraliza a transição de autenticação para que tanto o listener quanto o
  // retorno explícito do login atualizem o estado da mesma forma. O callback
  // do Supabase é assíncrono; confirmar aqui a sessão retornada pelo login
  // evita que a tela volte ao formulário enquanto ele ainda não foi emitido.
  const synchronizeAuthState = useCallback((nextSession: Session | null) => {
    if (signingOutRef.current && nextSession) return;
    if (!nextSession) {
      clearAuthState();
      return;
    }

    activeSessionRef.current = nextSession;
    const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY));
    if (lastActivity > 0 && Date.now() - lastActivity >= INACTIVITY_TIMEOUT_MS) {
      // Nunca aguarda outra chamada Supabase dentro do listener de auth.
      void signOut();
      return;
    }
    const nextUserId = nextSession?.user.id ?? null;
    setSession(nextSession);
    // SIGNED_IN repetido e TOKEN_REFRESHED não desmontam a página atual.
    if (activeUserIdRef.current === nextUserId) return;
    if (activeUserIdRef.current !== nextUserId) {
      ++authEventIdRef.current;
      queryClient.clear();
      activeUserIdRef.current = nextUserId;
    }
    setIsLoading(true);
    setUser(nextSession?.user ?? null);
    userRoleRef.current = null;
    setUserRole(null);
    setAuthError(null);
    setTimeout(() => void retryUserRole(), 0);
  }, [clearAuthState, retryUserRole, queryClient, signOut]);

  useEffect(() => {
    // onAuthStateChange já emite o evento INITIAL_SESSION com a sessão atual
    // logo após o subscribe, cobrindo a verificação inicial. Chamar
    // supabase.auth.getSession() em paralelo aqui gerava uma corrida: se essa
    // chamada resolvesse depois de um login (evento SIGNED_IN), ela sobrescrevia
    // o estado com o valor antigo (capturado antes do login) e travava a tela
    // de carregamento até um refresh. Por isso usamos só o listener.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        synchronizeAuthState(nextSession);
        if (event === "TOKEN_REFRESHED" && nextSession) {
          setTimeout(() => void retryUserRole(), 0);
        }
      }
    );

    // No fallback offline, a remoção do token no localStorage também precisa
    // encerrar a sessão exibida nas outras abas.
    const handleAuthStorage = (event: StorageEvent) => {
      if (event.key === AUTH_STORAGE_KEY && event.newValue === null) {
        synchronizeAuthState(null);
      }
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
      const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY));
      if (lastActivity > 0 && Date.now() - lastActivity >= INACTIVITY_TIMEOUT_MS) {
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

  const signIn = async (email: string, password: string) => {
    // Login novo não deve ficar bloqueado por revogação remota de sessão antiga.
    ++signOutOperationIdRef.current;
    signingOutRef.current = false;

    // Uma atividade de conta anterior no mesmo navegador pode já ter passado
    // dos 30 minutos. Registrar esta tentativa evita que o efeito de
    // inatividade encerre a sessão recém-autenticada imediatamente.
    const previousActivity = localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY);
    const attemptActivity = String(Date.now());
    localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, attemptActivity);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // O listener normalmente recebe SIGNED_IN, mas não dependemos somente
      // dele: a API já devolve a sessão válida nesta resposta.
      if (!error && data.session) {
        synchronizeAuthState(data.session);
        return { error: null };
      }

      if (localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY) === attemptActivity) {
        if (previousActivity === null) localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
        else localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, previousActivity);
      }

      return { error: error ?? new Error("Não foi possível confirmar sua sessão. Tente novamente.") };
    } catch (error) {
      if (localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY) === attemptActivity) {
        if (previousActivity === null) localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
        else localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, previousActivity);
      }

      return { error: error instanceof Error ? error : new Error(String(error)) };
    }
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          display_name: displayName,
        },
      },
    });
    return { error: error as Error | null };
  };

  useEffect(() => {
    if (!user) return;

    let timeoutId: number | undefined;

    const scheduleSignOut = () => {
      if (timeoutId) window.clearTimeout(timeoutId);

      const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY));
      // Number(null) é 0 (finito), não NaN — sem essa checagem extra de > 0,
      // uma chave ausente é lida como "última atividade na época Unix",
      // dando um remainingTime enormemente negativo e deslogando na hora.
      const elapsedTime = Number.isFinite(lastActivity) && lastActivity > 0
        ? Math.max(0, Date.now() - lastActivity)
        : 0;
      const remainingTime = INACTIVITY_TIMEOUT_MS - elapsedTime;

      if (remainingTime <= 0) {
        void signOut();
        return;
      }

      timeoutId = window.setTimeout(() => void signOut(), remainingTime);
    };

    // mousemove/scroll disparam dezenas de vezes por segundo; sem throttle,
    // cada um gravava no localStorage e reagendava o timeout, podendo
    // engasgar a UI durante uso normal (arrastar, rolar).
    const ACTIVITY_THROTTLE_MS = 5000;
    let lastRegisteredAt = 0;

    const registerActivity = () => {
      const now = Date.now();
      const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY));
      if (lastActivity > 0 && now - lastActivity >= INACTIVITY_TIMEOUT_MS) {
        void signOut();
        return;
      }
      if (now - lastRegisteredAt < ACTIVITY_THROTTLE_MS) return;
      lastRegisteredAt = now;
      localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(now));
      scheduleSignOut();
    };

    // O evento "storage" só dispara nas OUTRAS abas, não na que fez a
    // alteração — reagenda o timer local com base na atividade mais recente
    // registrada em qualquer aba, evitando que uma aba ociosa deslogue o
    // usuário enquanto ele está ativo em outra.
    const handleCrossTabActivity = (event: StorageEvent) => {
      if (event.key === LAST_ACTIVITY_STORAGE_KEY) {
        scheduleSignOut();
      }
    };

    if (localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY)) {
      scheduleSignOut();
    } else {
      registerActivity();
    }

    ACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, registerActivity));
    window.addEventListener("storage", handleCrossTabActivity);

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, registerActivity));
      window.removeEventListener("storage", handleCrossTabActivity);
    };
  }, [user, signOut]);

  return (
    <AuthContext.Provider
      value={{
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
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
