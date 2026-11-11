import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Calendar, Droplets, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import { formatLiters } from "@/lib/stockQuantity";
import type { StatisticsResult } from "@/lib/statistics";
import { cn } from "@/lib/utils";
import { SESSION_TYPES } from "@/types/database";

const ALL_TYPES = "all";
const ALL_TYPES_LABEL = "Todos os tipos";

interface AverageCardProps {
  title: string;
  icon: LucideIcon;
  value: string | number;
  className?: string;
  children: ReactNode;
}

function AverageCard({ title, icon: Icon, value, className, children }: AverageCardProps) {
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {children}
      </CardContent>
    </Card>
  );
}

interface ReportKpisProps {
  year: number;
  stats: StatisticsResult;
  /** Estatísticas restritas ao tipo selecionado (ou todas, sem seleção). */
  filteredStats: StatisticsResult;
  averageType: string;
  onAverageTypeChange: (type: string) => void;
}

export function ReportKpis({ year, stats, filteredStats, averageType, onAverageTypeChange }: ReportKpisProps) {
  const typeLabel = averageType || ALL_TYPES_LABEL;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <StatCard
        title="Total de Sessões"
        value={stats.totalSessions}
        subtitle={`Em ${year}`}
        icon={Calendar}
        variant="primary"
      />
      <StatCard
        title="Total Consumido"
        value={formatLiters(stats.totalConsumed)}
        subtitle="Consumo acumulado"
        icon={Droplets}
        variant="destructive"
      />
      <AverageCard title="Média por Sessão" icon={TrendingUp} value={formatLiters(filteredStats.averageConsumption)}>
        <Select
          value={averageType || ALL_TYPES}
          onValueChange={(value) => onAverageTypeChange(value === ALL_TYPES ? "" : value)}
        >
          <SelectTrigger className="w-full mt-2 h-8 text-xs">
            <SelectValue placeholder={ALL_TYPES_LABEL} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TYPES}>{ALL_TYPES_LABEL}</SelectItem>
            {SESSION_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </AverageCard>
      <AverageCard
        title="Média por Sócio"
        icon={Users}
        value={formatLiters(filteredStats.averageConsumptionPerMember, 3)}
      >
        <p className="text-xs text-muted-foreground mt-1">Por presença de sócio · {typeLabel}</p>
      </AverageCard>
      <AverageCard
        title="Média Participantes"
        icon={Users}
        value={Math.round(filteredStats.averageParticipants)}
        className="border-green-200 dark:border-green-900"
      >
        <p className="text-xs text-muted-foreground mt-1">{typeLabel}</p>
      </AverageCard>
    </div>
  );
}
