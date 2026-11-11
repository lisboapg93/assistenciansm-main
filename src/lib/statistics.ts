import type { Session, Vegetal } from "@/types/database";
import { getMemberDisplayName, getMemberIdentityKey } from "@/lib/memberDisplay";
import type { MemberDisplayData } from "@/lib/memberDisplay";
import { sumStockQuantities } from "@/lib/stockQuantity";

export interface StatisticsFilters {
  type?: string;
}

export interface ParticipantCount {
  name: string;
  count: number;
}

export interface ParticipantOccurrence {
  name: string;
  date: string;
  type: string;
}

export interface StatisticsResult {
  totalStock: number;
  totalSessions: number;
  totalConsumed: number;
  averageConsumption: number;
  averageConsumptionPerMember: number;
  averageParticipants: number;
  sessionsRemaining: number;
  monthsRemaining: number;
  frequencyDays: number;
  sessionsByType: Record<string, number>;
  topDirigentes: ParticipantCount[];
  topExplanadores: ParticipantCount[];
  topLeitores: ParticipantCount[];
  recentDirigentes: ParticipantOccurrence[];
  recentExplanadores: ParticipantOccurrence[];
  recentLeitores: ParticipantOccurrence[];
  sequenciaMestresAssistentes: ParticipantOccurrence[];
}

type SessionRoleField = "dirigente" | "explanador" | "leitor";
type DisplayNameResolver = (name: string) => string;

/** Intervalo assumido entre sessões quando não há histórico suficiente. */
const DEFAULT_FREQUENCY_DAYS = 30;
const AVERAGE_DAYS_PER_MONTH = 30.44;
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;
const TOP_PARTICIPANTS_LIMIT = 5;

const toNumber = (value: unknown) => Number(value) || 0;
const sessionTime = (session: Pick<Session, "date">) => new Date(session.date).getTime();

export function getTotalStock(vegetais: Pick<Vegetal, "quantity">[] | undefined): number {
  return sumStockQuantities((vegetais || []).map((vegetal) => toNumber(vegetal.quantity)));
}

function createDisplayNameResolver(members: MemberDisplayData[] | undefined): DisplayNameResolver {
  const displayNamesByIdentity = new Map(
    (members || []).map((member) => {
      const displayName = getMemberDisplayName(member);
      return [getMemberIdentityKey(displayName), displayName];
    }),
  );
  return (name) => displayNamesByIdentity.get(getMemberIdentityKey(name)) ?? name;
}

function countSessionsByType(sessions: Session[]): Record<string, number> {
  const sessionsByType: Record<string, number> = {};
  sessions.forEach((session) => {
    sessionsByType[session.type] = (sessionsByType[session.type] || 0) + 1;
  });
  return sessionsByType;
}

function getTopParticipants(
  sessions: Session[],
  field: SessionRoleField,
  resolveName: DisplayNameResolver,
): ParticipantCount[] {
  const counts: Record<string, number> = {};
  sessions.forEach((session) => {
    const name = session[field];
    if (!name) return;
    const displayName = resolveName(name);
    counts[displayName] = (counts[displayName] || 0) + 1;
  });

  return Object.entries(counts)
    .sort((first, second) => second[1] - first[1])
    .slice(0, TOP_PARTICIPANTS_LIMIT)
    .map(([name, count]) => ({ name, count }));
}

/** Participações mais recentes primeiro, mantendo repetições. */
function getRecentParticipants(
  sessionsByRecency: Session[],
  field: SessionRoleField,
  resolveName: DisplayNameResolver,
): ParticipantOccurrence[] {
  return sessionsByRecency.flatMap((session) => {
    const name = session[field];
    return name ? [{ name: resolveName(name), date: session.date, type: session.type }] : [];
  });
}

/** Mestres assistentes únicos, do mais recente para o mais antigo. */
function getAssistantSequence(
  sessionsByRecency: Session[],
  resolveName: DisplayNameResolver,
): ParticipantOccurrence[] {
  const seen = new Set<string>();
  const sequence: ParticipantOccurrence[] = [];
  for (const session of sessionsByRecency) {
    const displayName = session.mestre_assistente ? resolveName(session.mestre_assistente) : "";
    if (!displayName || seen.has(displayName)) continue;
    seen.add(displayName);
    sequence.push({ name: displayName, date: session.date, type: session.type });
  }
  return sequence;
}

function getAverageFrequencyDays(sessions: Session[]): number {
  if (sessions.length < 2) return DEFAULT_FREQUENCY_DAYS;
  const times = sessions.map(sessionTime).sort((first, second) => first - second);
  const totalDays = (times[times.length - 1] - times[0]) / MILLISECONDS_PER_DAY;
  return totalDays / (sessions.length - 1) || DEFAULT_FREQUENCY_DAYS;
}

function emptyStatistics(totalStock: number, sessionsByType: Record<string, number>): StatisticsResult {
  return {
    totalStock,
    totalSessions: 0,
    totalConsumed: 0,
    averageConsumption: 0,
    averageConsumptionPerMember: 0,
    averageParticipants: 0,
    sessionsRemaining: 0,
    monthsRemaining: 0,
    frequencyDays: 0,
    sessionsByType,
    topDirigentes: [],
    topExplanadores: [],
    topLeitores: [],
    recentDirigentes: [],
    recentExplanadores: [],
    recentLeitores: [],
    sequenciaMestresAssistentes: [],
  };
}

export function calculateStatistics(
  sessions: Session[] | undefined,
  vegetais: Pick<Vegetal, "quantity">[] | undefined,
  filters?: StatisticsFilters,
  members?: MemberDisplayData[],
): StatisticsResult {
  const allSessions = sessions || [];
  const totalStock = getTotalStock(vegetais);
  // A distribuição por tipo sempre considera todas as sessões, sem o filtro.
  const sessionsByType = countSessionsByType(allSessions);
  const filteredSessions = filters?.type
    ? allSessions.filter((session) => session.type === filters.type)
    : allSessions;

  const totalSessions = filteredSessions.length;
  if (totalSessions === 0) return emptyStatistics(totalStock, sessionsByType);

  const resolveName = createDisplayNameResolver(members);
  const totalConsumed = filteredSessions.reduce(
    (sum, session) => sum + toNumber(session.consumption?.total_consumed),
    0,
  );
  const totalMemberAttendances = filteredSessions.reduce(
    (sum, session) => sum + toNumber(session.participants?.socios),
    0,
  );
  const totalParticipants = filteredSessions.reduce(
    (sum, session) => sum + toNumber(session.total_participants),
    0,
  );
  const averageConsumption = totalConsumed / totalSessions;
  const frequencyDays = getAverageFrequencyDays(filteredSessions);
  const sessionsRemaining = averageConsumption > 0 ? totalStock / averageConsumption : 0;
  const sessionsByRecency = [...filteredSessions].sort((first, second) => sessionTime(second) - sessionTime(first));

  return {
    totalStock,
    totalSessions,
    totalConsumed,
    averageConsumption,
    averageConsumptionPerMember: totalMemberAttendances > 0 ? totalConsumed / totalMemberAttendances : 0,
    averageParticipants: totalParticipants / totalSessions,
    sessionsRemaining,
    monthsRemaining: (sessionsRemaining * frequencyDays) / AVERAGE_DAYS_PER_MONTH,
    frequencyDays,
    sessionsByType,
    topDirigentes: getTopParticipants(filteredSessions, "dirigente", resolveName),
    topExplanadores: getTopParticipants(filteredSessions, "explanador", resolveName),
    topLeitores: getTopParticipants(filteredSessions, "leitor", resolveName),
    recentDirigentes: getRecentParticipants(sessionsByRecency, "dirigente", resolveName),
    recentExplanadores: getRecentParticipants(sessionsByRecency, "explanador", resolveName),
    recentLeitores: getRecentParticipants(sessionsByRecency, "leitor", resolveName),
    sequenciaMestresAssistentes: getAssistantSequence(sessionsByRecency, resolveName),
  };
}
