import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, Settings } from "lucide-react";
import { QueryError } from "@/components/QueryError";
import { useStockMovements } from "@/hooks/useStockMovements";
import { formatBrazilianDateTime } from "@/lib/date";
import { getMovementsWithBalance, isIncomingMovement, isOutgoingMovement } from "@/lib/stockMovements";
import { formatLiters } from "@/lib/stockQuantity";
import type { MovementType } from "@/types/database";

interface StockMovementHistoryProps {
  vegetalId: string;
  currentQuantity: number;
  enabled: boolean;
}

function MovementIcon({ type }: { type: MovementType }) {
  if (isIncomingMovement(type)) return <ArrowUpRight className="h-4 w-4 text-primary" />;
  if (isOutgoingMovement(type)) return <ArrowDownRight className="h-4 w-4 text-destructive" />;
  return <Settings className="h-4 w-4 text-warning" />;
}

export function StockMovementHistory({ vegetalId, currentQuantity, enabled }: StockMovementHistoryProps) {
  const { data: movements, isLoading, isError, error, refetch } = useStockMovements(vegetalId, enabled);
  const movementsWithBalance = useMemo(
    () => getMovementsWithBalance(movements, currentQuantity),
    [movements, currentQuantity],
  );

  if (isError) return <QueryError error={error} onRetry={() => void refetch()} />;
  if (isLoading) {
    return <p className="py-4 text-center text-muted-foreground">Carregando movimentações...</p>;
  }
  if (movementsWithBalance.length === 0) {
    return <p className="text-center text-muted-foreground py-4">Nenhuma movimentação registrada</p>;
  }

  return (
    <>
      {movementsWithBalance.map((movement) => (
        <div key={movement.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
          <span className="mt-0.5 shrink-0"><MovementIcon type={movement.type} /></span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{movement.type}</p>
              <p className="text-sm text-muted-foreground">{formatBrazilianDateTime(movement.date)}</p>
            </div>
            <p className="text-xs text-muted-foreground break-words">{movement.details}</p>
            <p className="text-xs font-medium mt-1">
              Saldo após movimentação: {formatLiters(movement.balance)}
            </p>
          </div>
          <p className={`shrink-0 text-sm font-medium ${movement.effect >= 0 ? "text-primary" : "text-destructive"}`}>
            {movement.effect >= 0 ? "+" : "-"}
            {formatLiters(Math.abs(movement.effect))}
          </p>
        </div>
      ))}
    </>
  );
}
