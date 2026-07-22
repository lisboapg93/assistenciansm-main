import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Member {
  id: string;
  name: string;
  is_socio_nucleo: boolean;
  grau: string | null;
  created_at: string;
}

export function useMembers() {
  return useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Member[];
    },
  });
}

export function useAddMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const trimmedName = name.trim();
      if (!trimmedName) return null;

      // Check if name already exists
      const { data: existing } = await supabase
        .from("members")
        .select("id")
        .eq("name", trimmedName)
        .maybeSingle();

      if (existing) return existing;

      const { data, error } = await supabase
        .from("members")
        .insert({ name: trimmedName })
        .select()
        .single();

      if (error) {
        // Ignore unique constraint violations
        if (error.code === "23505") return null;
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });
}

// Helper function to add member if not exists (used in form submissions)
export async function addMemberIfNotExists(name: string) {
  const trimmedName = name.trim();
  if (!trimmedName) return;

  const { data: existing } = await supabase
    .from("members")
    .select("id")
    .eq("name", trimmedName)
    .maybeSingle();

  if (!existing) {
    await supabase.from("members").insert({ name: trimmedName });
  }
}
