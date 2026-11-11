import type { Participants } from "@/types/database";

export const MAX_PARTICIPANTS = 2147483647;

const TRANSMISSION_TYPES = ["Primeira Escala", "Segunda Escala", "Extra"];
const TRANSMISSION_PREFIX = /^\[Transmissão da Assistência - 2º Dirigente: ([^\]\r\n]+)\](?:\r?\n)?/;

export function allowsTransmission(type: string): boolean {
  return TRANSMISSION_TYPES.includes(type);
}

export function parseTransmissionObservation(observation: string) {
  const match = TRANSMISSION_PREFIX.exec(observation);
  return {
    segundoDirigente: match ? match[1].trim() : null,
    observation: match ? observation.slice(match[0].length) : observation,
  };
}

export function formatTransmissionObservation(segundoDirigente: string | null, observation: string): string {
  const prefix = segundoDirigente === null
    ? ""
    : `[Transmissão da Assistência - 2º Dirigente: ${segundoDirigente}]`;
  return [prefix, observation].filter(Boolean).join("\n");
}

export const EMPTY_PARTICIPANTS: Readonly<Participants> = {
  mestres: 0,
  conselheiros: 0,
  instrutivo: 0,
  socios: 0,
  visitantes: 0,
  jovens: 0,
};

export function sumParticipants(participants: Participants): number {
  return Object.values(participants).reduce((sum, count) => sum + count, 0);
}

export function areParticipantsValid(participants: Participants): boolean {
  const counts = Object.values(participants);
  const total = sumParticipants(participants);
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
