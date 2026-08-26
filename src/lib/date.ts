/**
 * Datas do banco estão salvas em UTC (ex: 2025-12-31T00:00:00+00:00).
 * Se converter direto para Date no navegador, o fuso pode "voltar" um dia.
 * Aqui tratamos como data-calendário (YYYY-MM-DD) e criamos um Date local.
 */
export function parseDbDateToLocal(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);

  // pega sempre o dia calendário, independentemente do horário/timezone
  const base = dateStr.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base);
  if (!match) return new Date(dateStr);

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);

  // Meio-dia reduz risco de mudanças de horário (DST) afetarem o dia
  return new Date(year, month, day, 12, 0, 0, 0);
}

/**
 * Constrói um limite de data (meia-noite UTC) a partir de ano/mês(0-based)/dia,
 * para comparar com colunas timestamptz que guardam o dia calendário em
 * meia-noite UTC (ex.: filtros de ano/mês em session.date). Usar
 * `new Date(year, month, day).toISOString()` aqui deslocaria o limite pelo
 * fuso do navegador, incluindo ou excluindo sessões do dia 1 indevidamente.
 */
export function toUtcDateBoundaryIso(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day)).toISOString();
}

/**
 * Data de hoje no fuso local, como "YYYY-MM-DD". `new Date().toISOString()`
 * converte para UTC antes de fatiar a data, podendo mostrar o dia seguinte
 * para usuários em fusos negativos (ex.: Brasil, UTC-3) à noite.
 */
export function todayLocalIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
