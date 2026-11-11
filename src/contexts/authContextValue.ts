import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/permissions";

export interface AuthContextType {
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
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);
