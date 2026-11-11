import { useMemo } from "react";
import { useVegetais } from "@/hooks/useVegetais";
import { calculateStatistics } from "@/lib/statistics";
import type { StatisticsFilters, StatisticsResult } from "@/lib/statistics";
import type { MemberDisplayData } from "@/lib/memberDisplay";
import type { Session } from "@/types/database";

export function useStatistics(
  sessions: Session[] | undefined,
  filters?: StatisticsFilters,
  members?: MemberDisplayData[],
): StatisticsResult {
  const { data: vegetais } = useVegetais();
  const type = filters?.type;

  return useMemo(
    () => calculateStatistics(sessions, vegetais, { type }, members),
    [sessions, vegetais, type, members],
  );
}
