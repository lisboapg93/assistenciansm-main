import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StockMovement, MovementType } from "@/types/database";

export function useStockMovements(vegetalId?: string) {
  return useQuery({
    queryKey: ["stock_movements", vegetalId],
    queryFn: async () => {
      let query = supabase
        .from("stock_movement")
        .select("*")
        .order("date", { ascending: false });

      if (vegetalId) {
        query = query.eq("vegetal_id", vegetalId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((m) => ({
        ...m,
        type: m.type as MovementType,
      })) as StockMovement[];
    },
  });
}
