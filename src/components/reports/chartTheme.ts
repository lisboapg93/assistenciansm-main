import type { CSSProperties } from "react";

export const CHART_GRID_STROKE = "hsl(var(--border))";
export const CHART_AXIS_STROKE = "hsl(var(--muted-foreground))";
export const CHART_BAR_FILL = "hsl(var(--primary))";

export const CHART_TOOLTIP_STYLE: CSSProperties = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
};

/** Componentes HSL ("h s% l%") para permitir variações com transparência. */
const RANKING_HUES = [
  "160 84% 39%",
  "38 92% 50%",
  "0 72% 51%",
  "200 80% 50%",
  "280 70% 50%",
] as const;

const RANKING_BACKGROUND_ALPHA = 0.125;

export function getRankingColors(position: number): { color: string; backgroundColor: string } {
  const hue = RANKING_HUES[position % RANKING_HUES.length];
  return {
    color: `hsl(${hue})`,
    backgroundColor: `hsl(${hue} / ${RANKING_BACKGROUND_ALPHA})`,
  };
}

export const STOCK_EVOLUTION_SERIES = [
  { key: "entrada", label: "Entradas", color: "hsl(160, 84%, 39%)", strokeWidth: 2 },
  { key: "saida", label: "Saídas", color: "hsl(38, 92%, 50%)", strokeWidth: 2 },
  { key: "consumo", label: "Consumo", color: "hsl(0, 72%, 51%)", strokeWidth: 2 },
  { key: "saldo", label: "Saldo acumulado", color: "hsl(280, 70%, 50%)", strokeWidth: 3 },
] as const;
