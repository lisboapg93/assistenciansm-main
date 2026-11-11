import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage, logAndThrow } from "@/lib/errorLogging";
import { isErrorLogMetadata, metadataText, sortErrorEntriesByRecency } from "@/lib/errorLogEntry";
import type { ErrorEntry, ErrorLogMetadata } from "@/lib/errorLogEntry";

export type { ErrorEntry } from "@/lib/errorLogEntry";
export { metadataText } from "@/lib/errorLogEntry";

export const ERROR_LOGS_QUERY_KEY = ["error-logs"] as const;

/** Quantidade máxima de registros carregados de cada origem. */
const ERROR_LOGS_LIMIT = 200;

const toMetadata = (value: unknown): ErrorLogMetadata => (isErrorLogMetadata(value) ? value : {});

function getStoredErrorMessage(message: string, code: string | null, metadata: ErrorLogMetadata) {
  return getErrorMessage({
    message,
    code,
    constraint: metadataText(metadata, "error_constraint"),
  });
}

async function fetchTechnicalErrors(): Promise<ErrorEntry[]> {
  const { data, error } = await supabase
    .from("error_logs")
    .select("id, error_message, error_location, operation, entity, entity_id, metadata, user_id, occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(ERROR_LOGS_LIMIT);

  if (error) {
    return logAndThrow(error, {
      location: "Erros.listTechnical",
      operation: "read",
      entity: "error_logs",
    });
  }

  return (data || []).map((row) => {
    const metadata = toMetadata(row.metadata);
    const code = metadataText(metadata, "error_code");
    return {
      id: `technical-${row.id}`,
      source: "técnico",
      operation: row.operation,
      entity: row.entity,
      entityId: row.entity_id,
      message: getStoredErrorMessage(row.error_message, code, metadata),
      code,
      location: row.error_location,
      userId: row.user_id,
      occurredAt: row.occurred_at,
      inputPayload: null,
      metadata,
    };
  });
}

async function fetchOperationalErrors(): Promise<ErrorEntry[]> {
  const { data, error } = await supabase.rpc("list_operation_failure_logs", { p_limit: ERROR_LOGS_LIMIT });

  if (error) {
    return logAndThrow(error, {
      location: "Erros.listOperational",
      operation: "read",
      entity: "operation_failure_logs",
    });
  }

  return (data || []).map((row) => {
    const metadata = toMetadata(row.metadata);
    const code = row.error_code || metadataText(metadata, "error_code");
    return {
      id: `operational-${row.id}`,
      source: "operacional",
      operation: row.operation,
      entity: row.entity,
      entityId: row.entity_id,
      message: getStoredErrorMessage(row.error_message, code, metadata),
      code: row.error_code,
      location: row.error_location,
      userId: row.user_id,
      occurredAt: row.occurred_at,
      inputPayload: toMetadata(row.input_payload),
      metadata,
    };
  });
}

export function useErrorLogs() {
  return useQuery({
    queryKey: ERROR_LOGS_QUERY_KEY,
    queryFn: async (): Promise<ErrorEntry[]> => {
      const [technicalErrors, operationalErrors] = await Promise.all([
        fetchTechnicalErrors(),
        fetchOperationalErrors(),
      ]);
      return sortErrorEntriesByRecency([...operationalErrors, ...technicalErrors]);
    },
  });
}
