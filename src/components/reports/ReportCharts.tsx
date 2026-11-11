import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpDown, BarChart3, TrendingUp } from "lucide-react";
import { EmptyChart, ReportCard } from "@/components/reports/ReportCard";
import {
  CHART_AXIS_STROKE,
  CHART_BAR_FILL,
  CHART_GRID_STROKE,
  CHART_TOOLTIP_STYLE,
  STOCK_EVOLUTION_SERIES,
} from "@/components/reports/chartTheme";
import { formatLiters } from "@/lib/stockQuantity";
import type { getMovementsByType, getStockEvolution } from "@/lib/stockReports";

export type MovementsByTypeRow = ReturnType<typeof getMovementsByType>[number];
export type StockEvolutionRow = ReturnType<typeof getStockEvolution>[number];

const BAR_CHART_HEIGHT = 280;
const LINE_CHART_HEIGHT = 300;
const AXIS_TICK = { fontSize: 12 };

const stockSeriesLabel = (name: string) =>
  STOCK_EVOLUTION_SERIES.find((series) => series.key === name)?.label ?? "Consumo";

export function SessionsByTypeChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ReportCard icon={BarChart3} title="Sessões por Tipo">
      {data.length === 0 ? (
        <EmptyChart message="Nenhuma sessão registrada" />
      ) : (
        <ResponsiveContainer width="100%" height={BAR_CHART_HEIGHT}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
            <XAxis type="number" stroke={CHART_AXIS_STROKE} />
            <YAxis dataKey="name" type="category" width={120} stroke={CHART_AXIS_STROKE} tick={AXIS_TICK} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Bar dataKey="value" fill={CHART_BAR_FILL} radius={4} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ReportCard>
  );
}

export function MovementsByTypeChart({ data }: { data: MovementsByTypeRow[] }) {
  return (
    <ReportCard icon={ArrowUpDown} title="Movimentações por Tipo">
      {data.length === 0 ? (
        <EmptyChart message="Nenhuma movimentação registrada" />
      ) : (
        <ResponsiveContainer width="100%" height={BAR_CHART_HEIGHT}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
            <XAxis type="number" stroke={CHART_AXIS_STROKE} />
            <YAxis dataKey="type" type="category" width={80} stroke={CHART_AXIS_STROKE} tick={AXIS_TICK} />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value: number, name: string) => [
                name === "litros" ? formatLiters(value) : value,
                name === "litros" ? "Volume" : "Qtd. Movimentações",
              ]}
            />
            <Bar dataKey="litros" fill={CHART_BAR_FILL} radius={4} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ReportCard>
  );
}

export function StockEvolutionChart({ data }: { data: StockEvolutionRow[] }) {
  return (
    <ReportCard icon={TrendingUp} title="Visão Acumulada do Estoque por Mês">
      {data.length === 0 ? (
        <EmptyChart message="Sem movimentações para exibir" />
      ) : (
        <ResponsiveContainer width="100%" height={LINE_CHART_HEIGHT}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
            <XAxis dataKey="month" stroke={CHART_AXIS_STROKE} />
            <YAxis stroke={CHART_AXIS_STROKE} />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value: number, name: string) => [formatLiters(value), stockSeriesLabel(name)]}
            />
            {STOCK_EVOLUTION_SERIES.map((series) => (
              <Line
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={series.key}
                stroke={series.color}
                strokeWidth={series.strokeWidth}
                dot={{ fill: series.color, strokeWidth: 2 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
      <div className="flex justify-center gap-6 mt-4 text-sm">
        {STOCK_EVOLUTION_SERIES.map((series) => (
          <div key={series.key} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: series.color }} />
            <span>{series.label}</span>
          </div>
        ))}
      </div>
    </ReportCard>
  );
}
