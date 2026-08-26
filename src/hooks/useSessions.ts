import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Session, Participants, Consumption } from "@/types/database";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { logAndThrow } from "@/lib/errorLogging";
import { toUtcDateBoundaryIso } from "@/lib/date";

type SessionInsert = Database["public"]["Tables"]["session"]["Insert"];
type SessionUpdate = Database["public"]["Tables"]["session"]["Update"];

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
    participants: session.participants as Participants,
    consumption: session.consumption as Consumption,
  })) as Session[];

export function useSessions(filters?: SessionFilters) {
  return useQuery({
    queryKey: ["sessions", filters],
    queryFn: async () => {
      let query = supabase
        .from("session")
        .select("*")
        .order("date", { ascending: false });

      // Filter by last X months (takes priority over year/month)
      if (filters?.lastMonths) {
        const now = new Date();
        const startDate = toUtcDateBoundaryIso(now.getFullYear(), now.getMonth() - filters.lastMonths, now.getDate());
        query = query.gte("date", startDate);
      } else {
        if (filters?.year) {
          const startDate = toUtcDateBoundaryIso(filters.year, 0, 1);
          const endDate = toUtcDateBoundaryIso(filters.year + 1, 0, 1);
          query = query.gte("date", startDate).lt("date", endDate);
        }

        if (filters?.month !== undefined && filters.month >= 0) {
          const year = filters.year || new Date().getFullYear();
          const startDate = toUtcDateBoundaryIso(year, filters.month, 1);
          const endDate = toUtcDateBoundaryIso(year, filters.month + 1, 1);
          query = query.gte("date", startDate).lt("date", endDate);
        }
      }

      // Filter by multiple types
      if (filters?.types && filters.types.length > 0) {
        query = query.in("type", filters.types);
      }

      const search = filters?.search ? sanitizeSearch(filters.search) : "";
      if (search) {
        query = query.or(
          `dirigente.ilike.*${search}*,explanador.ilike.*${search}*,leitor.ilike.*${search}*,mestre_assistente.ilike.*${search}*,type.ilike.*${search}*,observation.ilike.*${search}*`
        );
      }

      const { data, error } = await query;
      if (error) {
        return logAndThrow(error, {
          location: "useSessions.list",
          operation: "read",
          entity: "session",
        });
      }
      
      return mapSessions(data || []);
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
      let query = supabase
        .from("session")
        .select("*", { count: "exact" })
        .order("date", { ascending: false });

      if (filters?.lastMonths) {
        const now = new Date();
        const startDate = toUtcDateBoundaryIso(now.getFullYear(), now.getMonth() - filters.lastMonths, now.getDate());
        query = query.gte("date", startDate);
      } else {
        if (filters?.year) {
          const startDate = toUtcDateBoundaryIso(filters.year, 0, 1);
          const endDate = toUtcDateBoundaryIso(filters.year + 1, 0, 1);
          query = query.gte("date", startDate).lt("date", endDate);
        }
        if (filters?.month !== undefined && filters.month >= 0) {
          const year = filters.year || new Date().getFullYear();
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

      const offset = page * pageSize;
      const { data, error, count } = await query.range(offset, offset + pageSize - 1);
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
        participants: data.participants as unknown as Participants,
        consumption: data.consumption as unknown as Consumption,
      } as unknown as Session;
    },
    enabled: !!id,
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      session: Omit<Session, "id" | "created_at" | "updated_at">
    ) => {
      const { data, error } = await supabase
        .from("session")
        .insert(session as unknown as SessionInsert)
        .select()
        .single();

      if (error) {
        return logAndThrow(error, {
          location: "useSessions.create",
          operation: "create",
          entity: "session",
        });
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["vegetais"] });
      toast.success("Sessão registrada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao registrar sessão: " + error.message);
    },
  });
}

export function useUpdateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Session>;
    }) => {
      const { data, error } = await supabase
        .from("session")
        .update(updates as unknown as SessionUpdate)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        return logAndThrow(error, {
          location: "useSessions.update",
          operation: "update",
          entity: "session",
          entityId: id,
        });
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["session"] });
      toast.success("Sessão atualizada!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar sessão: " + error.message);
    },
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("session").delete().eq("id", id);
      if (error) {
        return logAndThrow(error, {
          location: "useSessions.delete",
          operation: "delete",
          entity: "session",
          entityId: id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["vegetais"] });
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] });
      toast.success("Sessão excluída e consumo de estoque revertido!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir sessão: " + error.message);
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
