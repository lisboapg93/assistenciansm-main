import { createContext, useCallback, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { logApplicationError } from "@/lib/errorLogging";

type AppRole = "viewer" | "editor" | "assistant";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
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
const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  // Descarta uma resposta de fetchUserRole desatualizada quando um segundo
  // evento de auth (ex.: SIGNED_IN de outra conta logo após um SIGNED_OUT)
  // chega antes da primeira consulta terminar.
  const authEventIdRef = useRef(0);

  // Fetch user role from database. `eventId` identifica o evento de auth que
  // disparou esta busca; se um evento mais novo já assumiu o estado antes da
  // consulta terminar, o resultado é descartado para não sobrescrever o papel
  // da conta correta com o de uma consulta desatualizada.
  const fetchUserRole = async (userId: string, eventId: number) => {
    const applyRole = (role: AppRole) => {
      if (authEventIdRef.current !== eventId) return;
      setUserRole(role);
    };

    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (error) {
        await logApplicationError(error, {
          location: "AuthContext.fetchUserRole",
          operation: "read",
          entity: "user_roles",
          entityId: userId,
        });
        // Default to viewer if can't fetch role
        applyRole("viewer");
        return;
      }

      applyRole((data?.role as AppRole) || "viewer");
    } catch (err) {
      await logApplicationError(err, {
        location: "AuthContext.fetchUserRole",
        operation: "read",
        entity: "user_roles",
        entityId: userId,
      });
      applyRole("viewer");
    }
  };

  useEffect(() => {
    // onAuthStateChange já emite o evento INITIAL_SESSION com a sessão atual
    // logo após o subscribe, cobrindo a verificação inicial. Chamar
    // supabase.auth.getSession() em paralelo aqui gerava uma corrida: se essa
    // chamada resolvesse depois de um login (evento SIGNED_IN), ela sobrescrevia
    // o estado com o valor antigo (capturado antes do login) e travava a tela
    // de carregamento até um refresh. Por isso usamos só o listener.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const eventId = ++authEventIdRef.current;
        setIsLoading(true);
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Consultas ao Supabase não devem ser aguardadas dentro deste callback.
          // Agenda a busca do papel para concluir a transição logo após o evento.
          setTimeout(() => {
            void fetchUserRole(session.user.id, eventId).finally(() => {
              // Um evento mais recente já assumiu o estado; ignora esta resposta.
              if (authEventIdRef.current !== eventId) return;
              setIsLoading(false);
            });
          }, 0);
        } else {
          setUserRole(null);
          setIsLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
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

  const signOut = useCallback(async () => {
    localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
    setUser(null);
    setSession(null);
    setUserRole(null);
    await supabase.auth.signOut();
  }, []);

  useEffect(() => {
    if (!user) return;

    let timeoutId: number | undefined;

    const scheduleSignOut = () => {
      if (timeoutId) window.clearTimeout(timeoutId);

      const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY));
      const elapsedTime = Number.isFinite(lastActivity) ? Date.now() - lastActivity : 0;
      const remainingTime = INACTIVITY_TIMEOUT_MS - elapsedTime;

      if (remainingTime <= 0) {
        void signOut();
        return;
      }

      timeoutId = window.setTimeout(() => void signOut(), remainingTime);
    };

    const registerActivity = () => {
      localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now()));
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
