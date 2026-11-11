interface ErrorWithDetails {
  message?: unknown;
  code?: unknown;
  constraint?: unknown;
  details?: unknown;
  hint?: unknown;
}

export const UNIQUE_VIOLATION_CODE = "23505";
export const SESSION_DUPLICATE_CONSTRAINT = "session_no_duplicate_logical_record_idx";
// Inclui restrições legadas, que ainda podem aparecer em registros antigos.
export const MEMBER_DUPLICATE_CONSTRAINTS: readonly string[] = [
  "members_name_key",
  "members_person_name_key_unique_idx",
  "members_identity_key_unique_idx",
];

export const SENSITIVE_LOG_FIELD_PATTERN = /password|passwd|token|secret|authorization|cookie|api[_-]?key|publishable[_-]?key|credential|connection[_-]?string/i;

function errorDetails(error: unknown): ErrorWithDetails {
  return typeof error === "object" && error !== null ? error as ErrorWithDetails : {};
}

export function getRawErrorMessage(error: unknown): string {
  const message = typeof error === "string" ? error : errorDetails(error).message;
  return typeof message === "string" ? message.trim() : "";
}

export function getErrorCode(error: unknown): string | null {
  const code = errorDetails(error).code;
  if (typeof code !== "string" && typeof code !== "number") return null;
  return /^[\w-]{1,100}$/.test(String(code)) ? String(code) : null;
}

export function getErrorConstraint(error: unknown): string | null {
  const explicit = errorDetails(error).constraint;
  // PostgREST normalmente inclui a restrição na mensagem, sem campo próprio.
  const constraint = typeof explicit === "string" ? explicit
    : getRawErrorMessage(error).match(/\bunique constraint "([\w$]+)"/i)?.[1];
  return constraint && /^[a-z_][\w$]{0,62}$/i.test(constraint) ? constraint : null;
}

export function getUniqueViolationEntity(error: unknown): "session" | "members" | null {
  if (getErrorCode(error) !== UNIQUE_VIOLATION_CODE) return null;
  const constraint = getErrorConstraint(error);
  if (constraint === SESSION_DUPLICATE_CONSTRAINT) return "session";
  if (constraint && MEMBER_DUPLICATE_CONSTRAINTS.includes(constraint)) return "members";
  // Compatibilidade com o erro explícito dos triggers antigos de membros.
  if (/^Já existe um membro com este nome[.!]?$/i.test(getRawErrorMessage(error))) return "members";
  return null;
}

export function sanitizeLogText(value: string): string {
  return value
    // Valores de registros nas mensagens do PostgreSQL podem incluir dados pessoais.
    .replace(/(Key\s*\([^\r\n]*?\)\s*=\s*)\([^\r\n]*\)/gi, "$1([oculto])")
    .replace(/Failing row contains[^\r\n]*/gi, "Failing row contains [oculto]")
    .replace(/\b(?:https?|postgres(?:ql)?):\/\/[^\s<>"']+/gi, "[URL oculta]")
    .replace(/(^|\n)(\s*(?:authorization|cookie|set-cookie)\s*:\s*)[^\r\n]*/gi, "$1$2[oculto]")
    .replace(/\b(Bearer|Basic)\s+[^\s,;"']+/gi, "$1 [oculto]")
    .replace(/\beyJ[\w-]*\.[\w-]+(?:\.[\w-]+)?\b/g, "[token oculto]")
    .replace(/\bsb_(?:secret|publishable)_[\w-]+/g, "[chave oculta]")
    .replace(/(["']?[\w-]*(?:password|passwd|token|secret|authorization|cookie|api[_-]?key|publishable[_-]?key|connection[_-]?string)[\w-]*["']?\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;}\]]+)/gi, "$1[oculto]")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[e-mail oculto]")
    .replace(/'(?:''|[^'])*'/g, "'[oculto]'")
    .slice(0, 500);
}

export function getErrorDiagnostics(error: unknown): Record<string, string> {
  const fields = errorDetails(error);
  const diagnostics: Record<string, string> = {};
  const values = {
    error_code: getErrorCode(error),
    error_constraint: getErrorConstraint(error),
    original_message: getRawErrorMessage(error),
    error_details: fields.details,
    error_hint: fields.hint,
  };
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string" && value.trim()) diagnostics[key] = sanitizeLogText(value);
  }
  return diagnostics;
}
