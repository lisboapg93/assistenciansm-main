import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Session, Participants, Consumption } from "@/types/database";
import { toast } from "sonner";

interface SessionFilters {
  year?: number;
  month?: number;
  types?: string[];
  search?: string;
  lastMonths?: number;
}

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
        const startDate = new Date(now.getFullYear(), now.getMonth() - filters.lastMonths, now.getDate()).toISOString();
        query = query.gte("date", startDate);
      } else {
        if (filters?.year) {
          const startDate = new Date(filters.year, 0, 1).toISOString();
          const endDate = new Date(filters.year + 1, 0, 1).toISOString();
          query = query.gte("date", startDate).lt("date", endDate);
        }

        if (filters?.month !== undefined && filters.month >= 0) {
          const year = filters.year || new Date().getFullYear();
          const startDate = new Date(year, filters.month, 1).toISOString();
          const endDate = new Date(year, filters.month + 1, 1).toISOString();
          query = query.gte("date", startDate).lt("date", endDate);
        }
      }

      // Filter by multiple types
      if (filters?.types && filters.types.length > 0) {
        query = query.in("type", filters.types);
      }

      if (filters?.search) {
        query = query.or(
          `dirigente.ilike.%${filters.search}%,explanador.ilike.%${filters.search}%,leitor.ilike.%${filters.search}%,mestre_assistente.ilike.%${filters.search}%,type.ilike.%${filters.search}%,observation.ilike.%${filters.search}%,chamadas.ilike.%${filters.search}%,historias.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Parse JSONB fields
      return (data || []).map((session) => ({
        ...session,
        participants: session.participants as unknown as Participants,
        consumption: session.consumption as unknown as Consumption,
      })) as Session[];
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
      if (error) throw error;
      if (!data) return null;
      
      return {
        ...data,
        participants: data.participants as unknown as Participants,
        consumption: data.consumption as unknown as Consumption,
      } as Session;
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
        .insert(session as any)
        .select()
        .single();

      if (error) throw error;
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
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
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
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("Sessão excluída!");
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
