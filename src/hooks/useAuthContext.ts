import { useContext } from "react";
import { AuthContext, type AuthContextType } from "@/contexts/authContextValue";

export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext deve ser usado dentro de um AuthProvider");
  }
  return context;
}
