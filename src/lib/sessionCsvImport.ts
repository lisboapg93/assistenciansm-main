import Papa from "papaparse";
import type { ConsumptionSource, Participants } from "@/types/database";
import { CSV_TEMPLATE_HEADERS, mapSessionCsvRows } from "@/lib/sessionCsv";
import type { SessionCsvColumn } from "@/lib/sessionCsv";
import { formatTransmissionObservation, sumParticipants } from "@/lib/sessionData";
import type { ParsedSession } from "@/lib/sessionCsvValidation";
import type { SessionRegistrationInput } from "@/lib/sessionRegistration";

const MAX_REPORTED_PARSE_ERRORS = 5;
const TEMPLATE_DELIMITER = ";";
// Excel às vezes adiciona uma primeira linha do tipo: sep=;
const EXCEL_SEPARATOR_HINT = /^sep=(.)/i;

export const CSV_TEMPLATE_FILE_NAME = "modelo_importacao_sessoes.csv";

const TEMPLATE_EXAMPLE: Record<SessionCsvColumn, string> = {
  data: "2025-01-15",
  tipo: "Primeira Escala",
  transmissao_assistencia: "false",
  segundo_dirigente: "",
  dirigente: "João Silva",
  mestre_assistente: "Maria Santos",
  registrado_por: "Carlos Souza",
  explanador: "Pedro Costa",
  leitor: "Ana Lima",
  mestres: "5",
  conselheiros: "3",
  instrutivo: "2",
  socios: "20",
  visitantes: "5",
  jovens: "3",
  consumo_total: "2,5",
  vegetal_unido: "false",
  tem_foto: "true",
  tem_audio: "false",
  observacao: "Observações da sessão",
  fontes_vegetal: "ID_DO_LOTE:2,5",
};

/** Modelo com BOM para que o Excel abra os acentos corretamente. */
export function buildSessionCsvTemplate(): string {
  const headers = CSV_TEMPLATE_HEADERS.join(TEMPLATE_DELIMITER);
  const exampleRow = CSV_TEMPLATE_HEADERS.map((column) => TEMPLATE_EXAMPLE[column]).join(TEMPLATE_DELIMITER);
  return `\uFEFF${headers}\n${exampleRow}`;
}

export type SessionCsvRow = ReturnType<typeof mapSessionCsvRows>["rows"][number];

export interface SessionCsvTextParseResult {
  rows: SessionCsvRow[];
  delimiter?: string;
  /** Problemas de leitura exibidos ao usuário (no máximo alguns). */
  parseErrors: string[];
  /** Motivo pelo qual nenhuma linha pode ser importada. */
  error?: string;
}

/** Lê o texto do CSV (delimitador detectado) e associa as colunas do modelo. */
export function parseSessionCsvText(text: string): SessionCsvTextParseResult {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (!normalized) {
    return { rows: [], parseErrors: [], error: "O conteúdo do CSV está vazio" };
  }

  const [firstLine = "", ...otherLines] = normalized.split("\n");
  const separatorHint = EXCEL_SEPARATOR_HINT.exec(firstLine.trim());
  const body = separatorHint ? otherLines.join("\n") : normalized;
  const forcedDelimiter = separatorHint?.[1];

  const result = Papa.parse<string[]>(body, {
    delimiter: forcedDelimiter ?? "", // "" => detecção automática
    skipEmptyLines: "greedy",
    dynamicTyping: false,
  });
  const delimiter = forcedDelimiter ?? result.meta.delimiter;

  const parseErrors = (result.errors ?? []).map((error) => {
    const rowLabel = typeof error.row === "number" ? `linha ${error.row + 1}` : "linha ?";
    return `${rowLabel}: ${error.message}`;
  });
  if (parseErrors.length > 0) {
    return {
      rows: [],
      delimiter,
      parseErrors: parseErrors.slice(0, MAX_REPORTED_PARSE_ERRORS),
      error: "O CSV contém linhas com formato inválido. Corrija o arquivo e tente novamente.",
    };
  }

  const rawRows = (result.data ?? [])
    .filter((row): row is string[] => Array.isArray(row))
    .map((row) => row.map((cell) => String(cell ?? "").trim()))
    .filter((row) => row.some((cell) => cell !== ""));
  if (rawRows.length === 0) {
    return { rows: [], delimiter, parseErrors: [], error: "Não foi possível ler nenhuma linha do CSV" };
  }

  const mapping = mapSessionCsvRows(rawRows);
  if (mapping.error) {
    return { rows: [], delimiter, parseErrors: [mapping.error], error: mapping.error };
  }
  if (mapping.rows.length === 0) {
    return {
      rows: [],
      delimiter,
      parseErrors: [],
      error: "O CSV deve ter pelo menos uma linha de dados além do cabeçalho",
    };
  }

  return { rows: mapping.rows, delimiter, parseErrors: [] };
}

export function getParsedSessionParticipants(session: ParsedSession): Participants {
  return {
    mestres: session.mestres,
    conselheiros: session.conselheiros,
    instrutivo: session.instrutivo,
    socios: session.socios,
    visitantes: session.visitantes,
    jovens: session.jovens,
  };
}

/** Argumentos de registerSessionWithConsumption para uma linha válida do CSV. */
export function toSessionRegistration(session: ParsedSession): {
  session: SessionRegistrationInput;
  sources: ConsumptionSource[];
  memberNames: string[];
} {
  const participants = getParsedSessionParticipants(session);
  const observation = formatTransmissionObservation(
    session.is_transmissao_assistencia ? session.segundo_dirigente ?? "" : null,
    session.observation || "",
  ) || null;

  return {
    session: {
      date: session.date,
      type: session.type,
      dirigente: session.dirigente,
      mestre_assistente: session.mestre_assistente,
      registered_by_name: session.registered_by_name,
      explanador: session.explanador || null,
      leitor: session.leitor || null,
      participants,
      total_participants: sumParticipants(participants),
      total_consumed: session.total_consumed,
      is_united: session.is_united,
      has_photo: session.has_photo,
      has_audio: session.has_audio,
      observation,
    },
    sources: session.sources,
    memberNames: [session.dirigente, session.mestre_assistente, session.explanador]
      .filter((name): name is string => Boolean(name)),
  };
}
