import type { Participants } from "@/types/database";

export const MAX_PARTICIPANTS = 2147483647;

export function areParticipantsValid(participants: Participants): boolean {
  const counts = Object.values(participants);
  const total = counts.reduce((sum, count) => sum + count, 0);
  return counts.every(count => Number.isInteger(count) && count >= 0 && count <= MAX_PARTICIPANTS)
    && total > 0 && total <= MAX_PARTICIPANTS;
}

export function normalizeParticipants(value: unknown): Participants {
  const data = typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  const count = (key: string) => Number(data[key] ?? 0);
  return {
    mestres: count("mestres"),
    conselheiros: Number(data.conselheiros ?? data.conselho ?? 0),
    instrutivo: count("instrutivo"),
    socios: count("socios"),
    visitantes: count("visitantes"),
    jovens: count("jovens"),
  };
}
