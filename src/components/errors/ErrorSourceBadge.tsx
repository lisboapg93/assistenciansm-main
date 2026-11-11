import { Badge } from "@/components/ui/badge";
import type { ErrorSource } from "@/lib/errorLogEntry";

export function ErrorSourceBadge({ source }: { source: ErrorSource }) {
  return <Badge variant={source === "operacional" ? "destructive" : "secondary"}>{source}</Badge>;
}
