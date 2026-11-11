import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const LOGIN_ROUTE = "/";

/**
 * Fonte única de verdade das permissões por rota: usada pelo `ProtectedRoute`
 * e pela navegação lateral. Deve refletir as políticas RLS do Supabase — a
 * interface apenas esconde o que o banco já bloqueia.
 */
export const ROUTE_ROLES = {
  "/dashboard": ["viewer", "editor"],
  "/estoque": ["viewer", "editor", "assistant"],
  "/estoque/novo": ["editor"],
  "/sessao/nova": ["editor", "assistant"],
  "/sessao/editar/:id": ["editor"],
  "/historico": ["viewer", "editor", "assistant"],
  "/relatorios": ["viewer", "editor"],
  "/membros": ["editor"],
  "/atividades": ["viewer", "editor"],
  "/erros": ["editor"],
} as const satisfies Record<string, readonly AppRole[]>;

export type ProtectedRoutePath = keyof typeof ROUTE_ROLES;

const HOME_ROUTE_BY_ROLE: Record<AppRole, ProtectedRoutePath> = {
  editor: "/dashboard",
  viewer: "/dashboard",
  assistant: "/sessao/nova",
};

// Contas antigas podem ter mais de um papel; a precedência coincide com a
// verificação feita pelas funções do banco.
const ROLE_PRECEDENCE: readonly AppRole[] = ["editor", "assistant", "viewer"];

export function canAccessRoute(role: AppRole | null | undefined, path: ProtectedRoutePath): boolean {
  if (!role) return false;
  return (ROUTE_ROLES[path] as readonly AppRole[]).includes(role);
}

/** Tela inicial do papel, também usada como destino ao negar acesso a uma rota. */
export function getHomeRoute(role: AppRole): ProtectedRoutePath {
  return HOME_ROUTE_BY_ROLE[role];
}

/** Escolhe o papel efetivo entre os registrados para a conta; `null` se nenhum for válido. */
export function resolveEffectiveRole(roles: Iterable<string>): AppRole | null {
  const assigned = new Set(roles);
  return ROLE_PRECEDENCE.find((role) => assigned.has(role)) ?? null;
}
