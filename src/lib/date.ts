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
