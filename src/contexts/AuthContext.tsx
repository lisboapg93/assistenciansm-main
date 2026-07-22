import { createContext, useCallback, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

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

  // Fetch user role from database
  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (error) {
        console.error("Error fetching role:", error);
        // Default to viewer if can't fetch role
        setUserRole("viewer");
        return;
      }

      setUserRole(data?.role as AppRole || "viewer");
    } catch (err) {
      console.error("Error fetching role:", err);
      setUserRole("viewer");
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setIsLoading(true);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Consultas ao Supabase não devem ser aguardadas dentro deste callback.
          // Agenda a busca do papel para concluir a transição logo após o evento.
          setTimeout(() => {
            void fetchUserRole(session.user.id).finally(() => setIsLoading(false));
          }, 0);
        } else {
          setUserRole(null);
          setIsLoading(false);
        }
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchUserRole(session.user.id);
      }
      
      setIsLoading(false);
    });

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

    if (localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY)) {
      scheduleSignOut();
    } else {
      registerActivity();
    }

    ACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, registerActivity));

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, registerActivity));
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
