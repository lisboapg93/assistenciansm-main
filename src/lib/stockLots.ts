import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDbDateToLocal } from "@/lib/date";
import { getMemberDisplayNameForValue, normalizeName, type MemberDisplayData } from "@/lib/memberDisplay";
import type { Vegetal } from "@/types/database";

/** Abaixo deste saldo (em litros) o lote é destacado como estoque baixo. */
export const LOW_STOCK_THRESHOLD_LITERS = 2;

export type StockLevel = "empty" | "low" | "normal";

export function getStockLevel(quantity: number): StockLevel {
  const value = Number(quantity);
  if (value <= 0) return "empty";
  if (value < LOW_STOCK_THRESHOLD_LITERS) return "low";
  return "normal";
}

export function formatEnvaseDate(envaseDate: string): string {
  return format(parseDbDateToLocal(envaseDate), "dd/MM/yyyy", { locale: ptBR });
}

/** Busca por nome do lote ou mestre do preparo, ignorando acentos e caixa. */
export function filterVegetaisBySearch<T extends Pick<Vegetal, "name" | "master">>(
  vegetais: T[] | undefined,
  search: string,
  members: MemberDisplayData[] | undefined,
): T[] | undefined {
  const normalizedSearch = normalizeName(search);
  if (!normalizedSearch) return vegetais;

  return vegetais?.filter((vegetal) =>
    normalizeName(vegetal.name).includes(normalizedSearch)
    || normalizeName(getMemberDisplayNameForValue(vegetal.master, members)).includes(normalizedSearch),
  );
}
