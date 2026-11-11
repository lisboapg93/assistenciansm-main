import { useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Session, Consumption, ConsumptionSource } from "@/types/database";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { getErrorMessage, getUniqueViolationEntity, logAndThrow } from "@/lib/errorLogging";
import { subtractMonthsFromIsoDate, todayBrazilianIsoDate, toUtcDateBoundaryIso } from "@/lib/date";
import { normalizeParticipants } from "@/lib/sessionData";
import type { EditableSessionFields } from "@/lib/sessionForm";
import { registerSessionWithConsumption } from "@/lib/sessionRegistration";
import type { SessionRegistrationInput } from "@/lib/sessionRegistration";

type SessionRow = Database["public"]["Tables"]["session"]["Row"];
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
  value.trim().slice(0, MAX_SEARCH_LENGTH).replace(/[,%().]/g, " ");

const SESSION_LIST_QUERY_KEY = ["sessions"] as const;
const SESSION_DETAIL_QUERY_KEY = ["session"] as const;
const MAX_SEARCH_LENGTH = 100;

// Cadastrar uma sessão abate estoque e pode criar membros (RPC
// register_session_with_consumption), então todas essas listas mudam.
const SESSION_REGISTRATION_QUERY_KEYS = [
  SESSION_LIST_QUERY_KEY, ["vegetais"], ["stock_movements"], ["stock_forecast"], ["members"],
] as const;

const mapSession = (row: SessionRow): Session => ({
  ...row,
  participants: normalizeParticipants(row.participants),
  consumption: row.consumption as unknown as Consumption,
}) as Session;

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

    if (filters?.year && filters.month !== undefined && filters.month >= 0) {
      const year = filters.year;
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
    queryKey: [...SESSION_LIST_QUERY_KEY, filters],
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

      return rows.map(mapSession);
    },
  });
}

export function usePaginatedSessions(
  filters: SessionFilters | undefined,
  page: number,
  pageSize: number,
) {
  return useQuery({
    queryKey: [...SESSION_LIST_QUERY_KEY, "page", filters, page, pageSize],
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

      return { items: (data || []).map(mapSession), total: count || 0, page, pageSize };
    },
  });
}

export function useSession(id: string | undefined) {
  return useQuery({
    queryKey: [...SESSION_DETAIL_QUERY_KEY, id],
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
      return data ? mapSession(data) : null;
    },
    enabled: !!id,
  });
}

// Sessões com consumo são sempre criadas via registerSessionWithConsumption
// (src/lib/sessionRegistration.ts), que chama a RPC register_session_with_consumption
// e mantém o ledger de estoque (stock_movement) sincronizado atomicamente.
// Não adicione um INSERT direto em "session": ele bypassaria essa RPC e
// dessincronizaria o estoque.

export function invalidateSessionRegistrationQueries(queryClient: QueryClient) {
  return Promise.all(SESSION_REGISTRATION_QUERY_KEYS.map((queryKey) =>
    queryClient.invalidateQueries({ queryKey })));
}

/** Para fluxos que cadastram várias sessões fora de useRegisterSession (ex.: importação CSV). */
export function useInvalidateSessionRegistration() {
  const queryClient = useQueryClient();
  return useCallback(() => invalidateSessionRegistrationQueries(queryClient), [queryClient]);
}

function getRegistrationErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "PGRST202") {
    return "A função de registro ainda não está disponível no banco. Atualize as migrations do Supabase e tente novamente.";
  }
  return getErrorMessage(error);
}

export type SessionRegistrationOutcome = "created" | "duplicate";

export function useRegisterSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ session, sources, memberNames }: {
      session: SessionRegistrationInput;
      sources: ConsumptionSource[];
      memberNames: string[];
    }): Promise<SessionRegistrationOutcome> => {
      try {
        await registerSessionWithConsumption(session, sources, memberNames);
        return "created";
      } catch (error) {
        // Um duplo envio (ou outra aba) já gravou a sessão: não é falha.
        if (getUniqueViolationEntity(error) === "session") return "duplicate";
        throw error;
      }
    },
    onSuccess: async (outcome) => {
      await invalidateSessionRegistrationQueries(queryClient);
      if (outcome === "duplicate") {
        toast.warning("Esta sessão já foi registrada. Não foi criada uma nova duplicata.");
      } else {
        toast.success("Sessão registrada com sucesso!");
      }
    },
    onError: (error) => {
      toast.error("Erro ao registrar sessão: " + getRegistrationErrorMessage(error));
    },
  });
}

/**
 * Cadastros feitos por outra conta não passam pelo cache deste navegador.
 * Invalida as listas de sessões assim que o banco recebe uma inclusão,
 * edição ou exclusão.
 */
export function useSessionChangesSubscription(channelName: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session" },
        () => {
          void queryClient.invalidateQueries({ queryKey: SESSION_LIST_QUERY_KEY });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelName, queryClient]);
}

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
    // update_session_metadata recusa campos de consumo e não toca em
    // stock_movement: lotes e movimentações não mudam. A previsão de estoque
    // usa o histórico (datas/participantes) e as funções podem criar membros.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSION_LIST_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: SESSION_DETAIL_QUERY_KEY });
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
      queryClient.invalidateQueries({ queryKey: SESSION_LIST_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: SESSION_DETAIL_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["vegetais"] });
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] });
      queryClient.invalidateQueries({ queryKey: ["stock_forecast"] });
      toast.success("Sessão excluída e consumo de estoque revertido!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir sessão: " + getErrorMessage(error));
    },
  });
}
