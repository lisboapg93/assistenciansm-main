import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Vegetal } from "@/types/database";
import { toast } from "sonner";
import { getErrorMessage, logAndThrow } from "@/lib/errorLogging";
import type { VegetalInput } from "@/lib/stockEntry";
import type { ManualStockOperation } from "@/lib/stockMovements";

export type { VegetalInput } from "@/lib/stockEntry";
export type { ManualStockOperation } from "@/lib/stockMovements";

export interface StockForecast {
  sessions_remaining: number;
  months_remaining: number;
}

export interface UpdateVegetalStockInput {
  id: string;
  /** Saída recebe a quantidade retirada; Ajuste recebe o novo saldo. */
  quantity: number;
  movementType: ManualStockOperation;
  movementDetails?: string;
  expectedQuantity: number;
}

type InventoryRpcError = { code?: string; message: string };
type RpcResult<T> = Promise<{ data: T | null; error: InventoryRpcError | null }>;

// As funções abaixo foram criadas pelas migrations de estoque; os casts ficam
// locais até que os tipos do Supabase sejam regenerados a partir do schema.
type StockForecastRpc = (functionName: "get_stock_forecast") => RpcResult<StockForecast>;
type CreateVegetalRpc = (
  functionName: "create_vegetal_with_movement",
  args: { p_vegetal: VegetalInput },
) => RpcResult<Vegetal>;
type ChangeVegetalStockRpc = (
  functionName: "change_vegetal_stock",
  args: {
    p_vegetal_id: string;
    p_operation: ManualStockOperation;
    p_quantity: number;
    p_expected_quantity: number;
    p_details: string | null;
  },
) => RpcResult<Vegetal>;

const VEGETAIS_PAGE_SIZE = 1000;
const VEGETAIS_QUERY_KEY = ["vegetais"] as const;
const STOCK_MOVEMENTS_QUERY_KEY = ["stock_movements"] as const;
const STOCK_FORECAST_QUERY_KEY = ["stock_forecast"] as const;
const MEMBERS_QUERY_KEY = ["members"] as const;

function invalidateStockQueries(queryClient: QueryClient) {
  for (const queryKey of [VEGETAIS_QUERY_KEY, STOCK_MOVEMENTS_QUERY_KEY, STOCK_FORECAST_QUERY_KEY]) {
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

export function useStockForecast(enabled: boolean) {
  return useQuery({
    queryKey: STOCK_FORECAST_QUERY_KEY,
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
    mutationFn: async (vegetal: VegetalInput) => {
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
      // O lote pode cadastrar automaticamente mestre, auxiliar e responsáveis.
      void queryClient.invalidateQueries({ queryKey: MEMBERS_QUERY_KEY });
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
    mutationFn: async (input: UpdateVegetalStockInput) => {
      const { id, quantity, movementType, movementDetails, expectedQuantity } = input;
      const rpc = supabase.rpc.bind(supabase) as unknown as ChangeVegetalStockRpc;
      const { data, error } = await rpc("change_vegetal_stock", {
        p_vegetal_id: id,
        p_operation: movementType,
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
          inputPayload: input,
        });
      }
      return data;
    },
    onSuccess: () => {
      invalidateStockQueries(queryClient);
      toast.success("Vegetal atualizado!");
    },
    onError: (error) => {
      // Um conflito de saldo (alteração concorrente) exige recarregar o lote.
      void queryClient.invalidateQueries({ queryKey: VEGETAIS_QUERY_KEY });
      toast.error("Erro ao atualizar: " + getErrorMessage(error));
    },
  });
}
