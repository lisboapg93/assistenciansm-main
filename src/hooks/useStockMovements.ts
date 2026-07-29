import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StockMovement, MovementType } from "@/types/database";
import { logAndThrow } from "@/lib/errorLogging";

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
      if (error) {
        return logAndThrow(error, {
          location: "useStockMovements.list",
          operation: "read",
          entity: "stock_movement",
          metadata: { filtered_by_vegetal: Boolean(vegetalId) },
        });
      }
      return (data || []).map((m) => ({
        ...m,
        type: m.type as MovementType,
      })) as StockMovement[];
    },
  });
}
