import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getErrorMessage, logAndThrow, type ErrorLogContext } from "@/lib/errorLogging";

export type Member = Database["public"]["Tables"]["members"]["Row"];

export type MemberInput = Pick<Member, "name" | "grau" | "is_socio_nucleo">;

export interface SaveMemberInput {
  /** Ausente ao cadastrar; presente ao editar. */
  id?: string;
  member: MemberInput;
}

const MEMBERS_PAGE_SIZE = 500;
const MEMBERS_QUERY_KEY = ["members"] as const;

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

function getSaveMemberLogContext({ id, member }: SaveMemberInput): ErrorLogContext {
  return id
    ? {
      location: "Membros.update",
      operation: "update",
      entity: "members",
      entityId: id,
      inputPayload: { id, updates: member },
    }
    : {
      location: "Membros.create",
      operation: "create",
      entity: "members",
      inputPayload: { member },
    };
}

export function useSaveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveMemberInput) => {
      const { id, member } = input;
      const logContext = getSaveMemberLogContext(input);

      if (id) {
        const { data, error } = await supabase.from("members")
          .update(member).eq("id", id).select("id").maybeSingle();
        if (error) return logAndThrow(error, logContext);
        if (!data) {
          return logAndThrow(
            new Error("O registro do membro não foi encontrado ou você não tem permissão para alterá-lo."),
            logContext,
          );
        }
        return;
      }

      const { error } = await supabase.from("members").insert(member);
      if (error) return logAndThrow(error, logContext);
    },
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: MEMBERS_QUERY_KEY });
      toast.success(id ? "Membro atualizado com sucesso" : "Membro adicionado com sucesso");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error) || "Erro ao salvar membro");
    },
  });
}

export function useDeleteMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (member: Pick<Member, "id" | "name">) => {
      const logContext: ErrorLogContext = {
        location: "Membros.delete",
        operation: "delete",
        entity: "members",
        entityId: member.id,
        inputPayload: { id: member.id, name: member.name },
      };
      const { data, error } = await supabase.from("members")
        .delete().eq("id", member.id).select("id").maybeSingle();
      if (error) return logAndThrow(error, logContext);
      if (!data) {
        return logAndThrow(
          new Error("O registro do membro já foi excluído ou você não tem permissão para excluí-lo."),
          logContext,
        );
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MEMBERS_QUERY_KEY });
      toast.success("Membro excluído com sucesso");
    },
    onError: (error) => {
      // Se outra pessoa já excluiu o membro, a lista precisa refletir isso.
      void queryClient.invalidateQueries({ queryKey: MEMBERS_QUERY_KEY });
      toast.error(getErrorMessage(error) || "Erro ao excluir membro");
    },
  });
}
