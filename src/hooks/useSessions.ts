import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Session, Consumption } from "@/types/database";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { getErrorMessage, logAndThrow } from "@/lib/errorLogging";
import { subtractMonthsFromIsoDate, todayBrazilianIsoDate, toUtcDateBoundaryIso } from "@/lib/date";
import { normalizeParticipants } from "@/lib/sessionData";

type SessionRow = Database["public"]["Tables"]["session"]["Row"];
type EditableSessionFields = Partial<Pick<Session,
  "date" | "type" | "dirigente" | "explanador" | "leitor" |
  "mestre_assistente" | "observation" | "participants" |
  "total_participants" | "has_photo" | "has_audio"
>>;
type UpdateSessionRpc = (
  functionName: "update_session_metadata",
  args: { p_session_id: string; p_updates: EditableSessionFields },
) => Promise<{ data: SessionRow | null; error: { code?: string; message: string } | null }>;
const FETCH_PAGE_SIZE = 500;

export interface SessionFilters {
  year?: number;
  month?: number;
  types?: string[];
  search?: string;
  lastMonths?: number;
}

export interface SessionPage {
  items: Session[];
  total: number;
  page: number;
  pageSize: number;
}

const sanitizeSearch = (value: string) =>
  value.trim().slice(0, 100).replace(/[,%().]/g, " ");

const mapSessions = (data: Array<{ participants: unknown; consumption: unknown }>) =>
  data.map((session) => ({
    ...session,
    participants: normalizeParticipants(session.participants),
    consumption: session.consumption as Consumption,
  })) as Session[];

function buildSessionsQuery(filters?: SessionFilters, withCount = false) {
  let query = supabase
    .from("session")
    .select("*", withCount ? { count: "exact" } : undefined)
    .order("date", { ascending: false })
    .order("id", { ascending: false });

  // Filter by last X months (takes priority over year/month)
  if (filters?.lastMonths) {
    const startDate = `${subtractMonthsFromIsoDate(todayBrazilianIsoDate(), filters.lastMonths)}T00:00:00.000Z`;
    query = query.gte("date", startDate);
  } else {
    if (filters?.year) {
      const startDate = toUtcDateBoundaryIso(filters.year, 0, 1);
      const endDate = toUtcDateBoundaryIso(filters.year + 1, 0, 1);
      query = query.gte("date", startDate).lt("date", endDate);
    }

    if (filters?.month !== undefined && filters.month >= 0) {
      const year = filters.year || Number(todayBrazilianIsoDate().slice(0, 4));
      const startDate = toUtcDateBoundaryIso(year, filters.month, 1);
      const endDate = toUtcDateBoundaryIso(year, filters.month + 1, 1);
      query = query.gte("date", startDate).lt("date", endDate);
    }
  }

  if (filters?.types?.length) query = query.in("type", filters.types);

  const search = filters?.search ? sanitizeSearch(filters.search) : "";
  if (search) {
    query = query.or(
      `dirigente.ilike.*${search}*,explanador.ilike.*${search}*,leitor.ilike.*${search}*,mestre_assistente.ilike.*${search}*,type.ilike.*${search}*,observation.ilike.*${search}*`,
    );
  }

  return query;
}

export function useSessions(filters?: SessionFilters, enabled = true) {
  return useQuery({
    queryKey: ["sessions", filters],
    enabled,
    queryFn: async () => {
      const rows: SessionRow[] = [];
      for (let offset = 0; ;) {
        const { data, error, count } = await buildSessionsQuery(filters, true)
          .range(offset, offset + FETCH_PAGE_SIZE - 1);
        if (error) {
          return logAndThrow(error, {
            location: "useSessions.list",
            operation: "read",
            entity: "session",
            metadata: { offset, page_size: FETCH_PAGE_SIZE },
          });
        }

        rows.push(...(data || []));
        if (!data?.length || (count !== null && rows.length >= count)) break;
        offset += data.length;
      }

      return mapSessions(rows);
    },
  });
}

export function usePaginatedSessions(
  filters: SessionFilters | undefined,
  page: number,
  pageSize: number,
) {
  return useQuery({
    queryKey: ["sessions", "page", filters, page, pageSize],
    queryFn: async (): Promise<SessionPage> => {
      const offset = page * pageSize;
      const { data, error, count } = await buildSessionsQuery(filters, true)
        .range(offset, offset + pageSize - 1);
      if (error) {
        return logAndThrow(error, {
          location: "useSessions.paginatedList",
          operation: "read",
          entity: "session",
          metadata: { page, page_size: pageSize },
        });
      }

      return { items: mapSessions(data || []), total: count || 0, page, pageSize };
    },
  });
}

export function useSession(id: string | undefined) {
  return useQuery({
    queryKey: ["session", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("session")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        return logAndThrow(error, {
          location: "useSessions.getById",
          operation: "read",
          entity: "session",
          entityId: id,
        });
      }
      if (!data) return null;
      
      return {
        ...data,
        participants: normalizeParticipants(data.participants),
        consumption: data.consumption as unknown as Consumption,
      } as unknown as Session;
    },
    enabled: !!id,
  });
}

// Sessões com consumo são sempre criadas via registerSessionWithConsumption
// (src/lib/sessionRegistration.ts), que chama a RPC register_session_with_consumption
// e mantém o ledger de estoque (stock_movement) sincronizado atomicamente.
// Um useCreateSession que fizesse INSERT direto em "session" bypassaria essa
// RPC e dessincronizaria o estoque, então não existe aqui de propósito — não
// adicione um sem passar pela RPC.

export function useUpdateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: EditableSessionFields;
    }) => {
      const rpc = supabase.rpc.bind(supabase) as unknown as UpdateSessionRpc;
      const { data, error } = await rpc("update_session_metadata", { p_session_id: id, p_updates: updates });

      if (error) {
        return logAndThrow(error, {
          location: "useSessions.update",
          operation: "update",
          entity: "session",
          entityId: id,
          inputPayload: { updates },
        });
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["session"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["stock_forecast"] });
      toast.success("Sessão atualizada!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar sessão: " + getErrorMessage(error));
    },
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from("session").delete().eq("id", id).select("id").maybeSingle();
      if (error) {
        return logAndThrow(error, {
          location: "useSessions.delete",
          operation: "delete",
          entity: "session",
          entityId: id,
          inputPayload: { id },
        });
      }
      if (!data) return logAndThrow(new Error("A sessão já foi excluída ou você não tem permissão para excluí-la."), {
        location: "useSessions.delete", operation: "delete", entity: "session", entityId: id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["session"] });
      queryClient.invalidateQueries({ queryKey: ["vegetais"] });
      queryClient.invalidateQueries({ queryKey: ["vegetal"] });
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] });
      queryClient.invalidateQueries({ queryKey: ["stock_forecast"] });
      toast.success("Sessão excluída e consumo de estoque revertido!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir sessão: " + getErrorMessage(error));
    },
  });
}

// Get unique names for autocomplete
export function useUniqueNames() {
  const { data: sessions } = useSessions();

  const getUnique = (field: keyof Session) => {
    if (!sessions) return [];
    const names = sessions
      .map((s) => s[field] as string)
      .filter((name): name is string => !!name);
    return [...new Set(names)].sort();
  };

  return {
    dirigentes: getUnique("dirigente"),
    explanadores: getUnique("explanador"),
    leitores: getUnique("leitor"),
    mestresAssistentes: getUnique("mestre_assistente"),
  };
}
