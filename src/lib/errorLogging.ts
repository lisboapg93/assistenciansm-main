import { supabase } from "@/integrations/supabase/client";
import {
  getErrorCode, getErrorConstraint, getErrorDiagnostics, getRawErrorMessage,
  getUniqueViolationEntity, sanitizeLogText, SENSITIVE_LOG_FIELD_PATTERN,
} from "@/lib/errorDiagnostics";

export { getUniqueViolationEntity } from "@/lib/errorDiagnostics";

type ErrorLogMetadataValue = string | number | boolean | null;
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

const MUTATING_OPERATIONS = new Set(["create", "update", "delete", "import"]);

export interface ErrorLogContext {
  location: string;
  operation?: "create" | "read" | "update" | "delete" | "import" | "auth";
  entity?: string;
  entityId?: string;
  metadata?: Record<string, ErrorLogMetadataValue>;
  inputPayload?: unknown;
}

function isPortugueseMessage(message: string): boolean {
  return /\b(não|nao|erro|falha|sessão|sessao|usuário|usuario|membro|dados?|campo|obrigatóri|inválid|invalíd|permissão|permissao|estoque|saldo|vegetal|fontes|insuficiente|quantidade|já|ja|exist|registro|conexão|conexao|atualiz|exclu|cadastr|salv|encontr|tente|acesso)\b/iu.test(message);
}

export function getErrorMessage(error: unknown): string {
  const rawMessage = getRawErrorMessage(error).trim();
  const normalizedMessage = rawMessage.toLocaleLowerCase("en-US");

  const duplicateEntity = getUniqueViolationEntity(error);
  if (duplicateEntity === "session") return "Esta sessão já foi registrada.";
  if (duplicateEntity === "members") return "Já existe um membro com este nome.";
  if (!rawMessage) return "Ocorreu um erro inesperado. Tente novamente.";
  if (isPortugueseMessage(rawMessage)) return rawMessage;

  if (normalizedMessage.includes("invalid login credentials")) {
    return "E-mail ou senha inválidos.";
  }
  if (normalizedMessage.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }
  if (normalizedMessage.includes("jwt expired") || normalizedMessage.includes("refresh token")) {
    return "Sua sessão expirou. Entre novamente para continuar.";
  }
  if (
    normalizedMessage.includes("failed to fetch") ||
    normalizedMessage.includes("network request failed") ||
    normalizedMessage.includes("load failed") ||
    normalizedMessage.includes("networkerror") ||
    normalizedMessage.includes("fetch failed")
  ) {
    return "Não foi possível conectar ao sistema. Verifique sua internet e tente novamente.";
  }
  if (normalizedMessage.includes("rate limit") || normalizedMessage.includes("too many requests")) {
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  }
  if (normalizedMessage.includes("duplicate key") || normalizedMessage.includes("unique constraint")) {
    return "Já existe um registro cadastrado com estes dados.";
  }
  if (normalizedMessage.includes("foreign key constraint")) {
    return "Não é possível concluir porque este registro está vinculado a outro.";
  }
  if (normalizedMessage.includes("not-null constraint")) {
    return "Preencha todos os campos obrigatórios.";
  }
  if (normalizedMessage.includes("check constraint")) {
    return "Os dados informados não são válidos.";
  }
  if (
    normalizedMessage.includes("row-level security") ||
    normalizedMessage.includes("permission denied") ||
    normalizedMessage.includes("not authorized") ||
    normalizedMessage.includes("unauthorized")
  ) {
    return "Você não tem permissão para realizar esta operação.";
  }
  if (normalizedMessage.includes("insufficient") || normalizedMessage.includes("not enough")) {
    return "Estoque insuficiente para concluir a operação.";
  }
  if (normalizedMessage.includes("pgrst202") || normalizedMessage.includes("function") && normalizedMessage.includes("does not exist")) {
    return "Uma função necessária do sistema não está disponível no momento.";
  }
  if (normalizedMessage.includes("pgrst116") || normalizedMessage.includes("0 rows")) {
    return "O registro solicitado não foi encontrado.";
  }

  return "Ocorreu um erro inesperado ao processar a operação. Tente novamente.";
}

function sanitizePayload(value: unknown, depth = 0): JsonValue {
  if (value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return sanitizeLogText(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (depth >= 5) return "[profundidade máxima]";

  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitizePayload(item, depth + 1));
  }

  if (typeof value === "object") {
    const payload: JsonObject = {};
    for (const [key, item] of Object.entries(value)) {
      payload[key] = SENSITIVE_LOG_FIELD_PATTERN.test(key)
        ? "[oculto]"
        : sanitizePayload(item, depth + 1);
    }
    return payload;
  }

  return String(value).slice(0, 1000);
}

type OperationFailureLogRpc = (
  functionName: "log_operation_failure",
  args: {
    p_error_code: string | null;
    p_error_location: string;
    p_error_message: string;
    p_entity: string;
    p_entity_id: string | null;
    p_input_payload: JsonObject;
    p_metadata: JsonObject;
    p_operation: "create" | "update" | "delete" | "import";
  },
) => Promise<{ data: string | null; error: { message: string } | null }>;

async function logOperationFailure(error: unknown, context: ErrorLogContext, metadata: JsonObject): Promise<void> {
  if (!context.operation || !MUTATING_OPERATIONS.has(context.operation)) return;

  const inputPayload = sanitizePayload(context.inputPayload ?? {});
  const rpc = supabase.rpc.bind(supabase) as unknown as OperationFailureLogRpc;

  try {
    const { error: loggingError } = await rpc("log_operation_failure", {
      p_error_code: getErrorCode(error),
      p_error_location: context.location,
      p_error_message: sanitizeLogText(getErrorMessage(error)),
      p_entity: context.entity || "unknown",
      p_entity_id: context.entityId || null,
      p_input_payload: typeof inputPayload === "object" && !Array.isArray(inputPayload)
        ? inputPayload as JsonObject
        : {},
      p_metadata: metadata,
      p_operation: context.operation as "create" | "update" | "delete" | "import",
    });

    if (loggingError) {
      console.error("[operation-error-logging] Não foi possível persistir o log", getErrorDiagnostics(loggingError));
    }
  } catch (loggingError) {
    console.error("[operation-error-logging] Falha inesperada ao persistir o log", getErrorDiagnostics(loggingError));
  }
}

export async function logApplicationError(
  error: unknown,
  context: ErrorLogContext,
): Promise<void> {
  const message = sanitizeLogText(getErrorMessage(error));
  const safeContext = sanitizePayload(context.metadata ?? {}) as JsonObject;
  const metadata = {
    ...safeContext,
    ...getErrorDiagnostics(error),
  };

  console.error(`[${context.location}] ${message}`, metadata);

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
      console.error("[error-logging] Não foi possível persistir o log", getErrorDiagnostics(loggingError));
    }
  } catch (loggingError) {
    // O registro de um log nunca deve esconder ou substituir o erro original.
    console.error("[error-logging] Falha inesperada ao persistir o log", getErrorDiagnostics(loggingError));
  }

  await logOperationFailure(error, context, metadata);
}

export async function logAndThrow(
  error: unknown,
  context: ErrorLogContext,
): Promise<never> {
  await logApplicationError(error, context);
  const publicError = new Error(getErrorMessage(error));
  const code = getErrorCode(error);
  const constraint = getErrorConstraint(error);
  if (code) Object.assign(publicError, { code });
  if (constraint) Object.assign(publicError, { constraint });
  throw publicError;
}
