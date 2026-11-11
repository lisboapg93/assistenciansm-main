import { getMemberIdentityKey, isMemberName } from "@/lib/memberDisplay";
import type { MemberGrau } from "@/lib/memberDisplay";

export interface MemberRoleData {
  name: string;
  grau: string | null;
}

const GRAU_QUADRO_DE_MESTRE: MemberGrau = "Quadro de Mestre";
const GRAU_QUADRO_DE_SOCIOS: MemberGrau = "Quadro de Sócios";
const GRAUS_DIRIGENTE_ESCALA: readonly string[] = [
  GRAU_QUADRO_DE_MESTRE,
  "Corpo do Conselho",
  "Corpo Instrutivo",
] satisfies MemberGrau[];
const TIPOS_SESSAO_ESCALA = ["Primeira Escala", "Segunda Escala", "Escala Anual"];

const findMember = (members: MemberRoleData[], name: string) =>
  members.find((member) => isMemberName(member, name));

export interface SessionRoleAssignment {
  type: string;
  isTransmissaoAssistencia: boolean;
  dirigente: string;
  segundoDirigente?: string;
  explanador?: string | null;
  leitor?: string | null;
  mestreAssistente?: string | null;
}

export interface SessionRoleEligibilityChecks {
  dirigente: boolean;
  segundoDirigente: boolean;
  explanador: boolean;
  leitor: boolean;
  mestreAssistente: boolean;
}

export function getSessionRoleEligibilityChecks(
  current: SessionRoleAssignment,
  original: SessionRoleAssignment,
): SessionRoleEligibilityChecks {
  const contextChanged = current.type !== original.type
    || current.isTransmissaoAssistencia !== original.isTransmissaoAssistencia;
  const changed = (name: string | null | undefined, previous: string | null | undefined) =>
    getMemberIdentityKey(name || "") !== getMemberIdentityKey(previous || "");

  return {
    dirigente: contextChanged || changed(current.dirigente, original.dirigente),
    segundoDirigente: contextChanged || changed(current.segundoDirigente, original.segundoDirigente),
    explanador: changed(current.explanador, original.explanador),
    leitor: changed(current.leitor, original.leitor),
    mestreAssistente: changed(current.mestreAssistente, original.mestreAssistente),
  };
}

export function getEligibleDirigentes<T extends MemberRoleData>(
  type: string,
  members: T[],
  onlyQuadroDeMestre = false,
): T[] {
  if (onlyQuadroDeMestre) {
    return members.filter((member) => member.grau === GRAU_QUADRO_DE_MESTRE);
  }

  if (TIPOS_SESSAO_ESCALA.includes(type)) {
    return members.filter((member) => GRAUS_DIRIGENTE_ESCALA.includes(member.grau || ""));
  }

  if (type === "Quadro de Mestres") {
    return members;
  }

  if (type === "Extra") {
    return members.filter((member) => member.grau !== GRAU_QUADRO_DE_SOCIOS);
  }

  return members.filter((member) => member.grau === GRAU_QUADRO_DE_MESTRE);
}

const isEligibleExplanadorGrau = (grau: string | null) => !!grau && grau !== GRAU_QUADRO_DE_SOCIOS;

export function getEligibleExplanadores<T extends MemberRoleData>(members: T[]): T[] {
  return members.filter((member) => isEligibleExplanadorGrau(member.grau));
}

export function getEligibleMestresAssistentes<T extends MemberRoleData>(members: T[]): T[] {
  return members.filter((member) => member.grau === GRAU_QUADRO_DE_MESTRE);
}

export function getDirigenteRuleDescription(type: string, onlyQuadroDeMestre = false) {
  if (onlyQuadroDeMestre) {
    return "Apenas membros do Quadro de Mestres.";
  }

  if (TIPOS_SESSAO_ESCALA.includes(type)) {
    return "Apenas Quadro de Mestres, Corpo do Conselho e Corpo Instrutivo.";
  }

  if (type === "Quadro de Mestres") {
    return "Todos os membros.";
  }

  if (type === "Extra") {
    return "Todos, exceto Quadro de Sócios.";
  }

  return "Apenas membros do Quadro de Mestres.";
}

export function isEligibleDirigente(
  type: string,
  name: string,
  members: MemberRoleData[],
  onlyQuadroDeMestre = false,
) {
  if (!name.trim()) return true;

  return getEligibleDirigentes(type, members, onlyQuadroDeMestre)
    .some((member) => isMemberName(member, name));
}

export function isEligibleMestreAssistente(name: string, members: MemberRoleData[]) {
  if (!name.trim()) return true;

  return findMember(members, name)?.grau === GRAU_QUADRO_DE_MESTRE;
}

export function isEligibleExplanador(name: string, members: MemberRoleData[]) {
  if (!name.trim()) return true;

  const member = findMember(members, name);
  return !!member && isEligibleExplanadorGrau(member.grau);
}

export function getSessionRoleValidationError({
  type,
  dirigente,
  segundoDirigente,
  explanador,
  leitor,
  mestreAssistente,
  onlyQuadroDeMestre,
  validateEligibility,
  members,
}: {
  type: string;
  dirigente: string;
  segundoDirigente?: string;
  explanador?: string;
  leitor?: string;
  mestreAssistente?: string;
  onlyQuadroDeMestre?: boolean;
  validateEligibility?: Partial<SessionRoleEligibilityChecks>;
  members: MemberRoleData[];
}) {
  const sessionRoles = [
    ["dirigente", dirigente],
    ["segundo dirigente", segundoDirigente],
    ["explanador", explanador],
    ["leitor", leitor],
  ] as const;

  const shouldCheckDuplicates = !validateEligibility || Object.values(validateEligibility).some(Boolean);

  if (shouldCheckDuplicates) {
    for (let index = 0; index < sessionRoles.length; index += 1) {
      const [role, name] = sessionRoles[index];
      if (!name?.trim()) continue;

      const duplicatedRole = sessionRoles
        .slice(index + 1)
        .find(([, otherName]) => otherName?.trim()
          && getMemberIdentityKey(otherName) === getMemberIdentityKey(name));

      if (duplicatedRole) {
        return `A mesma pessoa não pode ser ${role} e ${duplicatedRole[0]} na mesma sessão.`;
      }
    }
  }

  for (const [role, name, shouldValidate] of [
    ["dirigente", dirigente, validateEligibility?.dirigente ?? true],
    ["segundo dirigente", segundoDirigente, validateEligibility?.segundoDirigente ?? true],
  ] as const) {
    if (!name?.trim()) continue;

    if (shouldValidate && !isEligibleDirigente(type, name, members, onlyQuadroDeMestre)) {
      return `O ${role} deve ser um membro elegível para este tipo de sessão.`;
    }
  }

  if ((validateEligibility?.explanador ?? true)
    && explanador?.trim() && !isEligibleExplanador(explanador, members)) {
    return "O explanador deve ser um membro cadastrado e não pode ser do Quadro de Sócios.";
  }

  if ((validateEligibility?.mestreAssistente ?? true)
    && mestreAssistente?.trim() && !isEligibleMestreAssistente(mestreAssistente, members)) {
    return "O mestre assistente deve ser um membro do Quadro de Mestre.";
  }

  return null;
}
