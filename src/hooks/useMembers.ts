import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAndThrow } from "@/lib/errorLogging";

export interface Member {
  id: string;
  name: string;
  is_socio_nucleo: boolean;
  grau: string | null;
  chosen_name: string | null;
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
      if (error) {
        return logAndThrow(error, {
          location: "useMembers.list",
          operation: "read",
          entity: "members",
        });
      }
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
      const { data: existing, error: lookupError } = await supabase
        .from("members")
        .select("id")
        .eq("name", trimmedName)
        .maybeSingle();

      if (lookupError) {
        return logAndThrow(lookupError, {
          location: "useMembers.checkExistingBeforeCreate",
          operation: "read",
          entity: "members",
        });
      }

      if (existing) return existing;

      const { data, error } = await supabase
        .from("members")
        .insert({ name: trimmedName })
        .select()
        .single();

      if (error) {
        // Ignore unique constraint violations
        if (error.code === "23505") return null;
        return logAndThrow(error, {
          location: "useMembers.create",
          operation: "create",
          entity: "members",
        });
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

  const { data: existing, error: lookupError } = await supabase
    .from("members")
    .select("id")
    .eq("name", trimmedName)
    .maybeSingle();

  if (lookupError) {
    return logAndThrow(lookupError, {
      location: "addMemberIfNotExists.checkExisting",
      operation: "read",
      entity: "members",
    });
  }

  if (!existing) {
    const { error } = await supabase.from("members").insert({ name: trimmedName });
    if (error && error.code !== "23505") {
      return logAndThrow(error, {
        location: "addMemberIfNotExists.create",
        operation: "create",
        entity: "members",
      });
    }
  }
}
