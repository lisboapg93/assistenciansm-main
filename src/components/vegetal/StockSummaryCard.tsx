import type { ReactNode } from "react";
import { Calendar, Droplets, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StockSummaryCardProps {
  totalStockLabel: string;
  forecastLabel: string;
  durationLabel: string;
}

function SummaryItem({ icon, iconBackground, label, value, valueClassName = "" }: {
  icon: ReactNode;
  iconBackground: string;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${iconBackground}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${valueClassName}`.trim()}>{value}</p>
      </div>
    </div>
  );
}

export function StockSummaryCard({ totalStockLabel, forecastLabel, durationLabel }: StockSummaryCardProps) {
  return (
    <Card className="bg-gradient-to-r from-primary/15 to-card border-primary/20">
      <CardContent className="p-6">
        <div className="grid gap-6 md:grid-cols-3">
          <SummaryItem
            icon={<Droplets className="h-6 w-6 text-primary" />}
            iconBackground="bg-primary/20"
            label="Estoque Total"
            value={totalStockLabel}
            valueClassName="text-primary"
          />
          <SummaryItem
            icon={<Calendar className="h-6 w-6 text-success" />}
            iconBackground="bg-success/20"
            label="Previsão"
            value={forecastLabel}
          />
          <SummaryItem
            icon={<TrendingDown className="h-6 w-6 text-warning" />}
            iconBackground="bg-warning/20"
            label="Duração"
            value={durationLabel}
          />
        </div>
      </CardContent>
    </Card>
  );
}
