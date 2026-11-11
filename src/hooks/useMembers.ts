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

export type MemberInput = Pick<Member, "name" | "grau" | "is_socio_nucleo">;

const MEMBERS_PAGE_SIZE = 500;
const MEMBERS_QUERY_KEY = ["members"] as const;

async function findMemberByName(name: string, location: string) {
  const { data, error } = await supabase
    .from("members")
    .select("id")
    .eq("name", name)
    .maybeSingle();

  if (error) {
    return logAndThrow(error, { location, operation: "read", entity: "members" });
  }

  return data;
}

export function useMembers() {
  return useQuery({
    queryKey: MEMBERS_QUERY_KEY,
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

      const existing = await findMemberByName(trimmedName, "useMembers.checkExistingBeforeCreate");

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
      queryClient.invalidateQueries({ queryKey: MEMBERS_QUERY_KEY });
    },
  });
}

export function useSaveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, member }: { id?: string; member: MemberInput }) => {
      if (id) {
        const { data, error } = await supabase.from("members")
          .update(member).eq("id", id).select("id").maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Membro não encontrado ou sem permissão para atualizar.");
      } else {
        const { error } = await supabase.from("members").insert(member);
        if (error) throw error;
      }
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: MEMBERS_QUERY_KEY }); },
  });
}

export function useDeleteMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from("members")
        .delete().eq("id", id).select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Membro já excluído ou sem permissão para excluir.");
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: MEMBERS_QUERY_KEY }); },
  });
}

// Helper function to add member if not exists (used in form submissions)
export async function addMemberIfNotExists(name: string) {
  const trimmedName = name.trim();
  if (!trimmedName) return;

  const existing = await findMemberByName(trimmedName, "addMemberIfNotExists.checkExisting");

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
