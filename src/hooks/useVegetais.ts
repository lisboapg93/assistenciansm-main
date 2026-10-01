import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Vegetal } from "@/types/database";
import { toast } from "sonner";
import { getErrorMessage, logAndThrow } from "@/lib/errorLogging";

type InventoryRpcError = { code?: string; message: string };
type CreateVegetalRpc = (
  functionName: "create_vegetal_with_movement",
  args: { p_vegetal: Omit<Vegetal, "id" | "created_at" | "updated_at" | "is_archived"> },
) => Promise<{ data: Vegetal | null; error: InventoryRpcError | null }>;
type ChangeVegetalStockRpc = (
  functionName: "change_vegetal_stock",
  args: {
    p_vegetal_id: string;
    p_operation: "Saída" | "Ajuste";
    p_quantity: number;
    p_expected_quantity: number | null;
    p_details: string | null;
  },
) => Promise<{ data: Vegetal | null; error: InventoryRpcError | null }>;

const VEGETAIS_PAGE_SIZE = 1000;

export function useVegetais(showArchived = false) {
  return useQuery({
    queryKey: ["vegetais", showArchived],
    queryFn: async () => {
      const vegetais: Vegetal[] = [];
      for (let offset = 0; ;) {
        let query = supabase
          .from("vegetal")
          .select("*", { count: "exact" })
          .order("quantity", { ascending: false })
          .order("id", { ascending: true })
          .range(offset, offset + VEGETAIS_PAGE_SIZE - 1);

        if (!showArchived) {
          query = query.gt("quantity", 0);
        }

        const { data, error, count } = await query;
        if (error) {
          return logAndThrow(error, {
            location: "useVegetais.list",
            operation: "read",
            entity: "vegetal",
            metadata: { show_archived: showArchived, offset },
          });
        }
        const page = (data || []) as Vegetal[];
        vegetais.push(...page);
        if (count === null || (page.length === 0 && offset < count)) {
          return logAndThrow(new Error("Não foi possível carregar todos os lotes de vegetal"), {
            location: "useVegetais.list.pagination",
            operation: "read",
            entity: "vegetal",
            metadata: { show_archived: showArchived, offset, count },
          });
        }
        offset += page.length;
        if (offset >= count) break;
      }
      return vegetais;
    },
  });
}

export function useVegetal(id: string | undefined) {
  return useQuery({
    queryKey: ["vegetal", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("vegetal")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        return logAndThrow(error, {
          location: "useVegetais.getById",
          operation: "read",
          entity: "vegetal",
          entityId: id,
        });
      }
      return data as Vegetal | null;
    },
    enabled: !!id,
  });
}

export function useCreateVegetal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vegetal: Omit<Vegetal, "id" | "created_at" | "updated_at" | "is_archived">) => {
      // Added by the inventory migration; keep the cast local until Supabase
      // types can be regenerated from the deployed schema.
      const rpc = supabase.rpc.bind(supabase) as unknown as CreateVegetalRpc;
      const { data, error } = await rpc("create_vegetal_with_movement", {
        p_vegetal: vegetal,
      });

      if (error) {
        return logAndThrow(error, {
          location: "useVegetais.create",
          operation: "create",
          entity: "vegetal",
          inputPayload: { vegetal },
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vegetais"] });
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] });
      toast.success("Vegetal cadastrado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao cadastrar vegetal: " + getErrorMessage(error));
    },
  });
}

export function useUpdateVegetal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      quantity,
      movementType,
      movementDetails,
      expectedQuantity,
    }: {
      id: string;
      quantity: number;
      movementType: "Saída" | "Ajuste";
      movementDetails?: string;
      expectedQuantity?: number;
    }) => {
      const rpc = supabase.rpc.bind(supabase) as unknown as ChangeVegetalStockRpc;
      const { data, error } = await rpc("change_vegetal_stock", {
        p_vegetal_id: id,
        p_operation: movementType,
        // Saída recebe quantidade retirada; Ajuste recebe o novo saldo.
        p_quantity: quantity,
        p_expected_quantity: expectedQuantity ?? null,
        p_details: movementDetails ?? null,
      });

      if (error) {
        return logAndThrow(error, {
          location: "useVegetais.update",
          operation: "update",
          entity: "vegetal",
          entityId: id,
          inputPayload: { id, quantity, movementType, movementDetails, expectedQuantity },
        });
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vegetais"] });
      queryClient.invalidateQueries({ queryKey: ["vegetal"] });
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] });
      toast.success("Vegetal atualizado!");
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ["vegetais"] });
      queryClient.invalidateQueries({ queryKey: ["vegetal"] });
      toast.error("Erro ao atualizar: " + getErrorMessage(error));
    },
  });
}

export function useTotalStock() {
  const { data: vegetais } = useVegetais();
  return vegetais?.reduce((sum, v) => sum + Number(v.quantity), 0) || 0;
}
