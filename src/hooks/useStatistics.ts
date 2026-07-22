import { useMemo } from "react";
import { useVegetais } from "./useVegetais";
import { Session } from "@/types/database";

interface StatisticsFilters {
  year?: number;
  type?: string;
}

interface StatisticsResult {
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
  topDirigentes: { name: string; count: number }[];
  topExplanadores: { name: string; count: number }[];
  topLeitores: { name: string; count: number }[];
  recentDirigentes: { name: string; date: string; type: string }[];
  recentExplanadores: { name: string; date: string; type: string }[];
  recentLeitores: { name: string; date: string; type: string }[];
  sequenciaMestresAssistentes: { name: string; date: string; type: string }[];
}

export function useStatistics(sessions: Session[] | undefined, filters?: StatisticsFilters): StatisticsResult {
  const { data: vegetais } = useVegetais();

  return useMemo(() => {
    // Apply type filter if provided
    let filteredSessions = sessions || [];
    if (filters?.type) {
      filteredSessions = filteredSessions.filter(s => s.type === filters.type);
    }

    if (filteredSessions.length === 0) {
      return {
        totalStock: vegetais?.reduce((sum, v) => sum + Number(v.quantity), 0) || 0,
        totalSessions: 0,
        totalConsumed: 0,
        averageConsumption: 0,
        averageConsumptionPerMember: 0,
        averageParticipants: 0,
        sessionsRemaining: 0,
        monthsRemaining: 0,
        frequencyDays: 0,
        sessionsByType: {},
        topDirigentes: [],
        topExplanadores: [],
        topLeitores: [],
        recentDirigentes: [],
        recentExplanadores: [],
        recentLeitores: [],
        sequenciaMestresAssistentes: [],
      };
    }

    const totalStock = vegetais?.reduce((sum, v) => sum + Number(v.quantity), 0) || 0;
    const totalSessions = filteredSessions.length;
    const totalConsumed = filteredSessions.reduce(
      (sum, s) => sum + (s.consumption?.total_consumed || 0),
      0
    );
    const averageConsumption = totalConsumed / totalSessions;
    const totalMemberAttendances = filteredSessions.reduce(
      (sum, session) => sum + Number(session.participants?.socios || 0),
      0
    );
    const averageConsumptionPerMember =
      totalMemberAttendances > 0 ? totalConsumed / totalMemberAttendances : 0;
    const averageParticipants =
      filteredSessions.reduce((sum, s) => sum + s.total_participants, 0) / totalSessions;

    // Calculate frequency
    const dates = filteredSessions.map((s) => new Date(s.date).getTime()).sort();
    const totalDays =
      dates.length > 1 ? (dates[0] - dates[dates.length - 1]) / (1000 * 60 * 60 * 24) : 30;
    const frequencyDays = Math.abs(totalDays / (totalSessions - 1)) || 30;

    // Forecast
    const sessionsRemaining = averageConsumption > 0 ? totalStock / averageConsumption : 0;
    const monthsRemaining = (sessionsRemaining * frequencyDays) / 30.44;

    // Sessions by type (always use ALL sessions, not filtered)
    const sessionsByType: Record<string, number> = {};
    (sessions || []).forEach((s) => {
      sessionsByType[s.type] = (sessionsByType[s.type] || 0) + 1;
    });

    // Top participants by count
    const countBy = (field: "dirigente" | "explanador" | "leitor") => {
      const counts: Record<string, number> = {};
      filteredSessions.forEach((s) => {
        const name = s[field];
        if (name) {
          counts[name] = (counts[name] || 0) + 1;
        }
      });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));
    };

    // Recent participants by date (most recent first, including duplicates)
    const recentBy = (field: "dirigente" | "explanador" | "leitor") => {
      const sortedSessions = [...filteredSessions].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const result: { name: string; date: string; type: string }[] = [];
      for (const s of sortedSessions) {
        const name = s[field];
        if (name) {
          result.push({ name, date: s.date, type: s.type });
        }
      }
      return result;
    };

    // Sequência de Mestres Assistentes (nomes únicos, ordem do mais recente para o mais antigo)
    const sortedByDateDesc = [...filteredSessions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const seenAssistentes = new Set<string>();
    const sequenciaMestresAssistentes: { name: string; date: string; type: string }[] = [];
    for (const s of sortedByDateDesc) {
      const name = s.mestre_assistente;
      if (name && !seenAssistentes.has(name)) {
        seenAssistentes.add(name);
        sequenciaMestresAssistentes.push({ name, date: s.date, type: s.type });
      }
    }

    return {
      totalStock,
      totalSessions,
      totalConsumed,
      averageConsumption,
      averageConsumptionPerMember,
      averageParticipants,
      sessionsRemaining,
      monthsRemaining,
      frequencyDays,
      sessionsByType,
      topDirigentes: countBy("dirigente"),
      topExplanadores: countBy("explanador"),
      topLeitores: countBy("leitor"),
      recentDirigentes: recentBy("dirigente"),
      recentExplanadores: recentBy("explanador"),
      recentLeitores: recentBy("leitor"),
      sequenciaMestresAssistentes,
    };
  }, [sessions, vegetais, filters?.type]);
}
