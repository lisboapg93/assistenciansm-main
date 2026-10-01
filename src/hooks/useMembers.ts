import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAndThrow } from "@/lib/errorLogging";

export interface Member {
  id: string;
  name: string;
  is_socio_nucleo: boolean;
  grau: string | null;
  created_at: string;
}

const MEMBERS_PAGE_SIZE = 500;

export function useMembers() {
  return useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const members: Member[] = [];
      let offset = 0;

      while (true) {
        const { data, error, count } = await supabase
          .from("members")
          .select("*", { count: "exact" })
          .order("name", { ascending: true })
          .order("id", { ascending: true })
          .range(offset, offset + MEMBERS_PAGE_SIZE - 1);

        if (error) {
          return logAndThrow(error, {
            location: "useMembers.list",
            operation: "read",
            entity: "members",
            metadata: { offset },
          });
        }

        if (!data?.length) break;
        members.push(...data);
        offset += data.length;
        if (count !== null && offset >= count) break;
      }

      return members;
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
          inputPayload: { name: trimmedName },
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
        inputPayload: { name: trimmedName },
      });
    }
  }
}
