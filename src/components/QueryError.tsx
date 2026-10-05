import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/errorLogging";

export function QueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div role="alert" className="space-y-3 rounded-lg border p-6 text-center">
      <AlertCircle className="mx-auto h-6 w-6 text-destructive" />
      <p className="font-medium">Não foi possível carregar os dados</p>
      <p className="text-sm text-muted-foreground">{getErrorMessage(error)}</p>
      <Button variant="outline" onClick={onRetry}>Tentar novamente</Button>
    </div>
  );
}
