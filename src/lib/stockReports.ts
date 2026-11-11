import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { brazilianDateBoundaryIso, brazilianIsoDate, parseDbDateToLocal } from "@/lib/date";
import type { MovementType, StockMovement } from "@/types/database";

const movementEffect = (type: MovementType, quantity: number) => {
  if (type === "Entrada" || type === "Saldo") return Math.abs(quantity);
  if (type === "Ajuste") return -quantity;
  return -Math.abs(quantity);
};

export function getMovementsByType(
  movements: StockMovement[] | undefined,
  year: number,
  consumptionBySessionId: ReadonlyMap<string, number>,
) {
  if (!movements) return [];

  const yearMovements = movements.filter((m) => {
    const moveYear = Number(brazilianIsoDate(m.date).slice(0, 4));
    return moveYear === year;
  });

  const counts: Record<string, { type: string; quantidade: number; litros: number }> = {};
  const consumedSessions = new Set<string>();
  yearMovements.forEach((m) => {
    if (!counts[m.type]) {
      counts[m.type] = { type: m.type, quantidade: 0, litros: 0 };
    }
    counts[m.type].quantidade += 1;
    if (m.type !== "Consumo" || !m.session_id || consumedSessions.has(m.session_id)) {
      counts[m.type].litros += m.type === "Consumo" && m.session_id
        ? 0
        : Math.abs(m.quantity);
      return;
    }

    consumedSessions.add(m.session_id);
    counts[m.type].litros += consumptionBySessionId.get(m.session_id) ?? Math.abs(m.quantity);
  });

  return Object.values(counts).sort((a, b) => b.litros - a.litros);
}

export function getStockEvolution(
  movements: StockMovement[] | undefined,
  year: number,
  currentStock: number,
  consumptionBySessionId: ReadonlyMap<string, number>,
  currentYear: number,
) {
  if (!movements) return [];

  const yearStart = new Date(brazilianDateBoundaryIso(`${year}-01-01`)!).getTime();
  let accumulatedBalance = movements
    .filter((m) => new Date(m.date).getTime() < yearStart)
    .reduce((sum, m) => sum + movementEffect(m.type, Number(m.quantity)), 0);

  const yearMovements = movements
    .filter((m) => Number(brazilianIsoDate(m.date).slice(0, 4)) === year)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (yearMovements.length === 0) return [];

  // Group by month
  const monthlyData: Record<string, {
    month: string;
    entrada: number;
    saida: number;
    consumo: number;
    ledgerDelta: number;
  }> = {};
  const consumedSessions = new Set<string>();

  yearMovements.forEach((m) => {
    const calendarDate = brazilianIsoDate(m.date);
    const monthIndex = Number(calendarDate.slice(5, 7)) - 1;
    const monthKey = String(monthIndex).padStart(2, "0");
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        month: format(parseDbDateToLocal(calendarDate), "MMM", { locale: ptBR }),
        entrada: 0,
        saida: 0,
        consumo: 0,
        ledgerDelta: 0,
      };
    }

    monthlyData[monthKey].ledgerDelta += movementEffect(m.type, Number(m.quantity));

    if (m.type === "Entrada") {
      monthlyData[monthKey].entrada += Math.abs(Number(m.quantity));
    } else if (m.type === "Saída") {
      monthlyData[monthKey].saida += Math.abs(Number(m.quantity));
    } else if (m.type === "Ajuste") {
      if (Number(m.quantity) >= 0) monthlyData[monthKey].saida += Number(m.quantity);
      else monthlyData[monthKey].entrada += Math.abs(Number(m.quantity));
    } else if (m.type === "Consumo") {
      if (!m.session_id || !consumedSessions.has(m.session_id)) {
        if (m.session_id) consumedSessions.add(m.session_id);
        monthlyData[monthKey].consumo += consumptionBySessionId.get(m.session_id || "") ?? Math.abs(Number(m.quantity));
      }
    }
  });

  const evolution = Object.keys(monthlyData).sort().map((key) => {
    const data = monthlyData[key];
    accumulatedBalance += data.ledgerDelta;
    return {
      month: data.month,
      entrada: Number(data.entrada.toFixed(2)),
      saida: Number(data.saida.toFixed(2)),
      consumo: Number(data.consumo.toFixed(2)),
      saldo: Number(Math.max(0, accumulatedBalance).toFixed(2)),
    };
  });

  // The current balance must come from the current stock table. The movement
  // ledger is historical and can differ when older entries were corrected.
  if (year === currentYear && evolution.length > 0) {
    evolution[evolution.length - 1].saldo = Number(currentStock.toFixed(2));
  }

  return evolution;
}
