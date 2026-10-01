import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StockMovement, MovementType } from "@/types/database";
import type { Database } from "@/integrations/supabase/types";
import { logAndThrow } from "@/lib/errorLogging";

type StockMovementRow = Database["public"]["Tables"]["stock_movement"]["Row"];
const FETCH_PAGE_SIZE = 500;

export function useStockMovements(vegetalId?: string, enabled = true) {
  return useQuery({
    queryKey: ["stock_movements", vegetalId],
    enabled,
    queryFn: async () => {
      const rows: StockMovementRow[] = [];
      for (let offset = 0; ;) {
        let query = supabase
          .from("stock_movement")
          .select("*", { count: "exact" })
          .order("date", { ascending: false })
          .order("id", { ascending: false });

        if (vegetalId) {
          query = query.eq("vegetal_id", vegetalId);
        }

        const { data, error, count } = await query.range(offset, offset + FETCH_PAGE_SIZE - 1);
        if (error) {
          return logAndThrow(error, {
            location: "useStockMovements.list",
            operation: "read",
            entity: "stock_movement",
            metadata: { filtered_by_vegetal: Boolean(vegetalId), offset },
          });
        }

        rows.push(...(data || []));
        if (!data?.length || (count !== null && rows.length >= count)) break;
        offset += data.length;
      }

      return rows.map((m) => ({
        ...m,
        type: m.type as MovementType,
      })) as StockMovement[];
    },
  });
}
