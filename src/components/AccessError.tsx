import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/QueryError";

export function AccessError() {
  const { authError, retryUserRole, signOut } = useAuthContext();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4">
      <QueryError error={authError} onRetry={() => void retryUserRole()} />
      <Button variant="ghost" onClick={() => void signOut()}>Voltar ao login</Button>
    </div>
  );
}
