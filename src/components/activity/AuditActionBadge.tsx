import { Badge } from "@/components/ui/badge";
import type { AuditAction } from "@/hooks/useAuditLogs";
import { AUDIT_ACTION_LABELS } from "@/lib/auditLabels";

const ACTION_BADGE_VARIANTS: Record<AuditAction, "default" | "secondary" | "destructive"> = {
  create: "default",
  update: "secondary",
  delete: "destructive",
};

export function AuditActionBadge({ action }: { action: AuditAction }) {
  return <Badge variant={ACTION_BADGE_VARIANTS[action]}>{AUDIT_ACTION_LABELS[action]}</Badge>;
}
