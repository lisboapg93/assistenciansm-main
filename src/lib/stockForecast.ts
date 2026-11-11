export interface StockForecastState {
  isLoading: boolean;
  isUnavailable: boolean;
  hasSessionHistory: boolean;
  sessionsRemaining: number;
  monthsRemaining: number;
}

export interface StockForecastLabels {
  forecast: string;
  duration: string;
}

const sameLabel = (label: string): StockForecastLabels => ({ forecast: label, duration: label });

export function getStockForecastLabels({
  isLoading,
  isUnavailable,
  hasSessionHistory,
  sessionsRemaining,
  monthsRemaining,
}: StockForecastState): StockForecastLabels {
  if (isUnavailable) return sameLabel("Indisponível");
  if (isLoading) return sameLabel("Carregando...");
  if (!hasSessionHistory) return sameLabel("Sem histórico");

  return {
    forecast: `~${Math.floor(sessionsRemaining)} sessões`,
    duration: `~${monthsRemaining.toFixed(1)} meses`,
  };
}
