import { ArrowRight, Droplets } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatLiters } from "@/lib/stockQuantity";

interface StockOverviewCardProps {
  totalStock: number;
  sessionsRemaining: number;
  monthsRemaining: number;
  onOpenStock: () => void;
}

export function StockOverviewCard({
  totalStock,
  sessionsRemaining,
  monthsRemaining,
  onOpenStock,
}: StockOverviewCardProps) {
  return (
    <Card className="bg-gradient-to-br from-primary/20 via-primary/10 to-card border-primary/30 glow-primary">
      <CardContent className="p-6 md:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20">
              <Droplets className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Estoque Disponível</p>
              <p className="text-4xl md:text-5xl font-bold text-primary">{formatLiters(totalStock)}</p>
              {sessionsRemaining > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  ≈ {Math.floor(sessionsRemaining)} sessões / {monthsRemaining.toFixed(1)} meses
                </p>
              )}
            </div>
          </div>
          <Button onClick={onOpenStock} className="hidden md:flex gap-2">
            Sala do Vegetal
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        <Button onClick={onOpenStock} className="w-full md:hidden mt-4 gap-2">
          Sala do Vegetal
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
