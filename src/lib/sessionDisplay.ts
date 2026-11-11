import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDbDateToLocal } from "@/lib/date";

export const SESSION_DATE_FORMAT = "dd/MM/yyyy";

/** Formata session.date como dia calendário, sem deslocamento de fuso. */
export function formatSessionDate(date: string, pattern = SESSION_DATE_FORMAT): string {
  return format(parseDbDateToLocal(date), pattern, { locale: ptBR });
}
