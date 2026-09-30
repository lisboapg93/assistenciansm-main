import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAndThrow } from "@/lib/errorLogging";

export type AuditAction = "create" | "update" | "delete";
export type AuditEntityType = "session" | "vegetal" | "stock_movement" | "members";
export type AuditOrigin = "direct" | "session";

type AuditData = Record<string, unknown>;

interface AuditLogRow {
  id: string;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id: string;
  old_data: AuditData | null;
  new_data: AuditData | null;
  actor_id: string | null;
  actor_name: string | null;
  origin: AuditOrigin | null;
  related_session_id: string | null;
  occurred_at: string;
  total_count: number;
}

export interface AuditLog {
  id: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  oldData: AuditData | null;
  newData: AuditData | null;
  actorId: string | null;
  actorName: string | null;
  origin: AuditOrigin | null;
  relatedSessionId: string | null;
  occurredAt: string;
}

export interface AuditLogFilters {
  action?: AuditAction;
  entityType?: AuditEntityType;
  actorQuery?: string;
  occurredFrom?: string;
  occurredUntil?: string;
}

export interface AuditLogPage {
  items: AuditLog[];
  total: number;
}

type AuditLogsRpc = (
  functionName: "list_audit_logs",
  args: {
    p_limit: number;
    p_offset: number;
    p_action: AuditAction | null;
    p_entity_type: AuditEntityType | null;
    p_actor_query: string | null;
    p_occurred_from: string | null;
    p_occurred_until: string | null;
  },
) => Promise<{ data: AuditLogRow[] | null; error: { message: string } | null }>;

export function useAuditLogs(filters: AuditLogFilters, page: number, pageSize: number) {
  return useQuery({
    queryKey: ["audit-logs", filters, page, pageSize],
    queryFn: async (): Promise<AuditLogPage> => {
      const auditLogsRpc = supabase.rpc.bind(supabase) as unknown as AuditLogsRpc;
      const { data, error } = await auditLogsRpc("list_audit_logs", {
        p_limit: pageSize,
        p_offset: page * pageSize,
        p_action: filters.action ?? null,
        p_entity_type: filters.entityType ?? null,
        p_actor_query: filters.actorQuery?.trim() || null,
        p_occurred_from: filters.occurredFrom ?? null,
        p_occurred_until: filters.occurredUntil ?? null,
      });

      if (error) {
        return logAndThrow(error, {
          location: "useAuditLogs.list",
          operation: "read",
          entity: "audit_logs",
          metadata: { page, page_size: pageSize },
        });
      }

      const rows = data || [];
      return {
        items: rows.map((row) => ({
          id: row.id,
          action: row.action,
          entityType: row.entity_type,
          entityId: row.entity_id,
          oldData: row.old_data,
          newData: row.new_data,
          actorId: row.actor_id,
          actorName: row.actor_name,
          origin: row.origin,
          relatedSessionId: row.related_session_id,
          occurredAt: row.occurred_at,
        })),
        total: rows[0]?.total_count || 0,
      };
    },
  });
}
