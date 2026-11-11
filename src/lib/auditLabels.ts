import type { AuditAction, AuditEntityType, AuditLog } from "@/hooks/useAuditLogs";

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  create: "Cadastro",
  update: "Edição",
  delete: "Exclusão",
};

/** Rótulos no plural, usados no filtro de ações. */
export const AUDIT_ACTION_FILTER_LABELS: Record<AuditAction, string> = {
  create: "Cadastros",
  update: "Edições",
  delete: "Exclusões",
};

export const AUDIT_ENTITY_LABELS: Record<AuditEntityType, string> = {
  session: "Sessão",
  vegetal: "Lote de vegetal",
  stock_movement: "Movimentação de estoque",
  members: "Membro",
};

export function getAuditActorName(entry: Pick<AuditLog, "actorName" | "actorId">): string {
  if (entry.actorName) return entry.actorName;
  return entry.actorId ? `Conta ${entry.actorId}` : "Operação interna";
}

export function getAuditOriginLabel(entry: Pick<AuditLog, "origin">): string {
  if (entry.origin === "session") return "Automática da sessão";
  if (entry.origin === "direct") return "Direta";
  return "Não identificada";
}
