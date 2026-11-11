import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDbDateToLocal } from "@/lib/date";

/** Dia e mês (dd/MM) da sessão, sem deslocar o dia pelo fuso do navegador. */
export function formatSessionDayMonth(date: string): string {
  try {
    return format(parseDbDateToLocal(date), "dd/MM", { locale: ptBR });
  } catch {
    return date;
  }
}
