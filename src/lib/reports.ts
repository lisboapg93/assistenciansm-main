import { todayBrazilianIsoDate } from "@/lib/date";
import { getMemberDisplayNameForValue } from "@/lib/memberDisplay";
import type { MemberDisplayData } from "@/lib/memberDisplay";
import type { Session } from "@/types/database";

/** Primeiro ano com dados disponíveis nos relatórios. */
export const REPORTS_START_YEAR = 2025;

export interface AssistanceReportRow {
  type: string;
  sessions: number;
  consumption: number;
  memberAttendances: number;
  averageConsumption: number;
  averageConsumptionPerMember: number;
}

export function getCurrentBrazilianYear(): number {
  return Number(todayBrazilianIsoDate().slice(0, 4));
}

/** Anos selecionáveis, do mais recente para o mais antigo. */
export function getReportYears(currentYear: number, startYear = REPORTS_START_YEAR): number[] {
  const length = Math.max(1, currentYear - startYear + 1);
  return Array.from({ length }, (_, index) => currentYear - index);
}

/** Consumo de cada sessão, usado para não contar duas vezes as fontes de uma mesma sessão. */
export function getConsumptionBySessionId(sessions: Session[] | undefined): Map<string, number> {
  return new Map(
    (sessions || []).map((session) => [
      session.id,
      Math.abs(Number(session.consumption?.total_consumed) || 0),
    ]),
  );
}

function getAssistantDisplayName(session: Session, members: MemberDisplayData[] | undefined) {
  return session.mestre_assistente
    ? getMemberDisplayNameForValue(session.mestre_assistente, members)
    : "";
}

export function getAssistantNames(
  sessions: Session[] | undefined,
  members: MemberDisplayData[] | undefined,
): string[] {
  const names = new Set(
    (sessions || []).map((session) => getAssistantDisplayName(session, members)).filter(Boolean),
  );
  return [...names].sort((first, second) => first.localeCompare(second, "pt-BR"));
}

/** Sessões, consumo e médias por tipo de assistência, opcionalmente de um mestre assistente. */
export function getAssistanceReport(
  sessions: Session[] | undefined,
  members: MemberDisplayData[] | undefined,
  assistantName?: string,
): AssistanceReportRow[] {
  const filteredSessions = assistantName
    ? (sessions || []).filter((session) => getAssistantDisplayName(session, members) === assistantName)
    : sessions || [];

  const grouped = new Map<string, Pick<AssistanceReportRow, "type" | "sessions" | "consumption" | "memberAttendances">>();
  filteredSessions.forEach((session) => {
    const row = grouped.get(session.type) ?? { type: session.type, sessions: 0, consumption: 0, memberAttendances: 0 };
    row.sessions += 1;
    row.consumption += Number(session.consumption?.total_consumed) || 0;
    row.memberAttendances += Number(session.participants?.socios) || 0;
    grouped.set(session.type, row);
  });

  return [...grouped.values()]
    .map((row) => ({
      ...row,
      averageConsumption: row.consumption / row.sessions,
      averageConsumptionPerMember: row.memberAttendances > 0 ? row.consumption / row.memberAttendances : 0,
    }))
    .sort((first, second) => second.sessions - first.sessions);
}
