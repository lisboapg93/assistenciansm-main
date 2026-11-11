import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Vegetal } from "@/types/database";
import { toast } from "sonner";
import { getErrorMessage, logAndThrow } from "@/lib/errorLogging";

type InventoryRpcError = { code?: string; message: string };
interface StockForecast {
  sessions_remaining: number;
  months_remaining: number;
}
type StockForecastRpc = (
  functionName: "get_stock_forecast",
) => Promise<{ data: StockForecast | null; error: InventoryRpcError | null }>;
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
    p_expected_quantity: number;
    p_details: string | null;
  },
) => Promise<{ data: Vegetal | null; error: InventoryRpcError | null }>;

const VEGETAIS_PAGE_SIZE = 1000;
const VEGETAIS_QUERY_KEY = ["vegetais"] as const;
const VEGETAL_QUERY_KEY = ["vegetal"] as const;

function invalidateStockQueries(queryClient: QueryClient) {
  for (const queryKey of [VEGETAIS_QUERY_KEY, ["stock_movements"], ["stock_forecast"]]) {
    void queryClient.invalidateQueries({ queryKey });
  }
}

export function useVegetais(showArchived = false) {
  return useQuery({
    queryKey: [...VEGETAIS_QUERY_KEY, showArchived],
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
    queryKey: [...VEGETAL_QUERY_KEY, id],
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

export function useStockForecast(enabled: boolean) {
  return useQuery({
    queryKey: ["stock_forecast"],
    enabled,
    queryFn: async () => {
      const rpc = supabase.rpc.bind(supabase) as unknown as StockForecastRpc;
      const { data, error } = await rpc("get_stock_forecast");
      if (error) {
        return logAndThrow(error, {
          location: "Estoque.getStockForecast",
          operation: "read",
          entity: "session",
        });
      }
      return data;
    },
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
      invalidateStockQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["members"] });
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
      expectedQuantity: number;
    }) => {
      const rpc = supabase.rpc.bind(supabase) as unknown as ChangeVegetalStockRpc;
      const { data, error } = await rpc("change_vegetal_stock", {
        p_vegetal_id: id,
        p_operation: movementType,
        // Saída recebe quantidade retirada; Ajuste recebe o novo saldo.
        p_quantity: quantity,
        p_expected_quantity: expectedQuantity,
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
      invalidateStockQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: VEGETAL_QUERY_KEY });
      toast.success("Vegetal atualizado!");
    },
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: VEGETAIS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: VEGETAL_QUERY_KEY });
      toast.error("Erro ao atualizar: " + getErrorMessage(error));
    },
  });
}

export function useTotalStock() {
  const { data: vegetais } = useVegetais();
  return vegetais?.reduce((sum, v) => sum + Number(v.quantity), 0) || 0;
}
