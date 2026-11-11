import { explainError } from "@/lib/errorExplanation";
import type { ErrorExplanation } from "@/lib/errorExplanation";

export type ErrorLogMetadata = Record<string, unknown>;
export type ErrorSource = "operacional" | "técnico";
export type ErrorSourceFilter = ErrorSource | "all";

export interface ErrorEntry {
  id: string;
  source: ErrorSource;
  operation: string | null;
  entity: string | null;
  entityId: string | null;
  message: string;
  code: string | null;
  location: string;
  userId: string | null;
  occurredAt: string;
  inputPayload: ErrorLogMetadata | null;
  metadata: ErrorLogMetadata;
}

export interface TechnicalDiagnostic {
  mensagem_original: string | null;
  detalhes: string | null;
  orientacao: string | null;
}

export function isErrorLogMetadata(value: unknown): value is ErrorLogMetadata {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function metadataText(metadata: ErrorLogMetadata | null | undefined, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

/**
 * Explicação exibida na tela: prioriza a gravada no momento do erro e completa
 * com a calculada a partir do código e do local (registros antigos não a têm).
 */
export function explainStoredError(entry: ErrorEntry): ErrorExplanation {
  const text = (key: string) => metadataText(entry.metadata, key);
  const calculated = explainError({
    code: entry.code || text("error_code"),
    message: entry.message,
    originalMessage: text("original_message"),
    constraint: text("error_constraint"),
    hint: text("error_hint"),
    location: entry.location,
    operation: entry.operation,
    entity: entry.entity,
  });

  return {
    category: text("error_category") || calculated.category,
    summary: text("error_summary") || calculated.summary,
    cause: text("error_cause") || calculated.cause,
    recommendedAction: text("error_recommended_action") || calculated.recommendedAction,
    location: text("error_location_label") || calculated.location,
  };
}

/** Diagnóstico técnico já sanitizado no registro, ou null quando não há nenhum. */
export function getTechnicalDiagnostic(entry: ErrorEntry): TechnicalDiagnostic | null {
  const diagnostic = {
    mensagem_original: metadataText(entry.metadata, "original_message"),
    detalhes: metadataText(entry.metadata, "error_details"),
    orientacao: metadataText(entry.metadata, "error_hint"),
  };
  return Object.values(diagnostic).some(Boolean) ? diagnostic : null;
}

export function filterErrorEntries(
  entries: ErrorEntry[] | undefined,
  search: string,
  source: ErrorSourceFilter,
): ErrorEntry[] {
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  return (entries ?? []).filter((entry) => {
    if (source !== "all" && entry.source !== source) return false;
    if (!normalizedSearch) return true;
    return [entry.message, entry.location, entry.operation, entry.entity, entry.code]
      .some((value) => value?.toLocaleLowerCase("pt-BR").includes(normalizedSearch));
  });
}

/** Mais recentes primeiro, comparando instantes (e não o texto das datas). */
export function sortErrorEntriesByRecency(entries: ErrorEntry[]): ErrorEntry[] {
  return [...entries].sort((first, second) => Date.parse(second.occurredAt) - Date.parse(first.occurredAt));
}
