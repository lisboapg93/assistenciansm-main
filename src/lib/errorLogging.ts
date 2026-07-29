import { supabase } from "@/integrations/supabase/client";

type ErrorLogMetadataValue = string | number | boolean | null;

export interface ErrorLogContext {
  location: string;
  operation?: "create" | "read" | "update" | "delete" | "import" | "auth";
  entity?: string;
  entityId?: string;
  metadata?: Record<string, ErrorLogMetadataValue>;
}

interface ErrorWithDetails {
  message?: unknown;
  code?: unknown;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error !== null) {
    const message = (error as ErrorWithDetails).message;
    if (typeof message === "string" && message.trim()) return message;
  }

  if (typeof error === "string" && error.trim()) return error;
  return "Erro desconhecido";
}

function getErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as ErrorWithDetails).code;
  return typeof code === "string" || typeof code === "number" ? String(code) : null;
}

export async function logApplicationError(
  error: unknown,
  context: ErrorLogContext,
): Promise<void> {
  const message = getErrorMessage(error);
  const errorCode = getErrorCode(error);
  const metadata = {
    ...context.metadata,
    ...(errorCode ? { error_code: errorCode } : {}),
  };

  console.error(`[${context.location}] ${message}`, error);

  try {
    const { error: loggingError } = await supabase.rpc("log_application_error", {
      p_error_message: message,
      p_error_location: context.location,
      p_operation: context.operation,
      p_entity: context.entity,
      p_entity_id: context.entityId,
      p_metadata: metadata,
    });

    if (loggingError) {
      console.error("[error-logging] Não foi possível persistir o log", loggingError);
    }
  } catch (loggingError) {
    // O registro de um log nunca deve esconder ou substituir o erro original.
    console.error("[error-logging] Falha inesperada ao persistir o log", loggingError);
  }
}

export async function logAndThrow(
  error: unknown,
  context: ErrorLogContext,
): Promise<never> {
  await logApplicationError(error, context);
  throw error;
}
