import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage, logAndThrow } from "@/lib/errorLogging";

type JsonObject = Record<string, unknown>;

interface TechnicalErrorLog {
  id: string;
  error_message: string;
  error_location: string;
  operation: string | null;
  entity: string | null;
  entity_id: string | null;
  metadata: JsonObject;
  user_id: string | null;
  occurred_at: string;
}

interface OperationFailureLog {
  id: string;
  operation: "create" | "update" | "delete" | "import";
  entity: string;
  entity_id: string | null;
  error_message: string;
  error_code: string | null;
  error_location: string;
  input_payload: JsonObject;
  metadata: JsonObject;
  user_id: string | null;
  occurred_at: string;
}

export interface ErrorEntry {
  id: string;
  source: "operacional" | "técnico";
  operation: string | null;
  entity: string | null;
  entityId: string | null;
  message: string;
  code: string | null;
  location: string;
  userId: string | null;
  occurredAt: string;
  inputPayload: JsonObject | null;
  metadata: JsonObject;
}

type OperationFailureLogsRpc = (
  functionName: "list_operation_failure_logs",
  args: { p_limit: number },
) => Promise<{ data: OperationFailureLog[] | null; error: { message: string } | null }>;

export function metadataText(metadata: JsonObject, key: string) {
  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

function getStoredErrorMessage(message: string, code: string | null, metadata: JsonObject) {
  return getErrorMessage({
    message,
    code: code || metadataText(metadata, "error_code"),
    constraint: metadataText(metadata, "error_constraint"),
  });
}

export function useErrorLogs() {
  return useQuery({
    queryKey: ["error-logs"],
    queryFn: async (): Promise<ErrorEntry[]> => {
      const operationFailureRpc = supabase.rpc.bind(supabase) as unknown as OperationFailureLogsRpc;
      const [technicalResult, operationalResult] = await Promise.all([
        supabase
          .from("error_logs")
          .select("id, error_message, error_location, operation, entity, entity_id, metadata, user_id, occurred_at")
          .order("occurred_at", { ascending: false })
          .limit(200),
        operationFailureRpc("list_operation_failure_logs", { p_limit: 200 }),
      ]);

      if (technicalResult.error) {
        return logAndThrow(technicalResult.error, {
          location: "Erros.listTechnical",
          operation: "read",
          entity: "error_logs",
        });
      }
      if (operationalResult.error) {
        return logAndThrow(operationalResult.error, {
          location: "Erros.listOperational",
          operation: "read",
          entity: "operation_failure_logs",
        });
      }

      const technicalErrors = (technicalResult.data as TechnicalErrorLog[]).map((error) => ({
        id: `technical-${error.id}`,
        source: "técnico" as const,
        operation: error.operation,
        entity: error.entity,
        entityId: error.entity_id,
        message: getStoredErrorMessage(error.error_message, metadataText(error.metadata, "error_code"), error.metadata),
        code: typeof error.metadata.error_code === "string" ? error.metadata.error_code : null,
        location: error.error_location,
        userId: error.user_id,
        occurredAt: error.occurred_at,
        inputPayload: null,
        metadata: error.metadata,
      }));
      const operationalErrors = (operationalResult.data || []).map((error) => ({
        id: `operational-${error.id}`,
        source: "operacional" as const,
        operation: error.operation,
        entity: error.entity,
        entityId: error.entity_id,
        message: getStoredErrorMessage(error.error_message, error.error_code, error.metadata),
        code: error.error_code,
        location: error.error_location,
        userId: error.user_id,
        occurredAt: error.occurred_at,
        inputPayload: error.input_payload,
        metadata: error.metadata,
      }));

      return [...operationalErrors, ...technicalErrors]
        .sort((first, second) => second.occurredAt.localeCompare(first.occurredAt));
    },
  });
}
