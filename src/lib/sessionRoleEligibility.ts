export interface MemberRoleData {
  name: string;
  grau: string | null;
}

const GRAU_QUADRO_DE_MESTRE = "Quadro de Mestre";
const GRAU_QUADRO_DE_SOCIOS = "Quadro de Sócios";
const GRAUS_DIRIGENTE_ESCALA = [
  GRAU_QUADRO_DE_MESTRE,
  "Corpo do Conselho",
  "Corpo Instrutivo",
];
const TIPOS_SESSAO_ESCALA = ["Primeira Escala", "Segunda Escala", "Escala Anual"];

const normalizeName = (name: string) => name.trim().toLocaleLowerCase("pt-BR");

const findMember = (members: MemberRoleData[], name: string) =>
  members.find((member) => normalizeName(member.name) === normalizeName(name));

export function getEligibleDirigentes(
  type: string,
  members: MemberRoleData[],
  onlyQuadroDeMestre = false,
) {
  if (onlyQuadroDeMestre) {
    return members.filter((member) => member.grau === GRAU_QUADRO_DE_MESTRE);
  }

  if (TIPOS_SESSAO_ESCALA.includes(type)) {
    return members.filter((member) => GRAUS_DIRIGENTE_ESCALA.includes(member.grau || ""));
  }

  if (type === "Extra") {
    return members.filter((member) => member.grau !== GRAU_QUADRO_DE_SOCIOS);
  }

  return members.filter((member) => member.grau === GRAU_QUADRO_DE_MESTRE);
}

export function getDirigenteRuleDescription(type: string, onlyQuadroDeMestre = false) {
  if (onlyQuadroDeMestre) {
    return "Apenas membros do Quadro de Mestres.";
  }

  if (TIPOS_SESSAO_ESCALA.includes(type)) {
    return "Apenas Quadro de Mestres, Corpo do Conselho e Corpo Instrutivo.";
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
    .some((member) => normalizeName(member.name) === normalizeName(name));
}

export function isEligibleMestreAssistente(name: string, members: MemberRoleData[]) {
  if (!name.trim()) return true;

  return findMember(members, name)?.grau === GRAU_QUADRO_DE_MESTRE;
}

export function isEligibleExplanador(name: string, members: MemberRoleData[]) {
  if (!name.trim()) return true;

  return findMember(members, name)?.grau !== GRAU_QUADRO_DE_SOCIOS;
}

export function getSessionRoleValidationError({
  type,
  dirigente,
  segundoDirigente,
  explanador,
  leitor,
  mestreAssistente,
  onlyQuadroDeMestre,
  members,
}: {
  type: string;
  dirigente: string;
  segundoDirigente?: string;
  explanador?: string;
  leitor?: string;
  mestreAssistente?: string;
  onlyQuadroDeMestre?: boolean;
  members: MemberRoleData[];
}) {
  const sessionRoles = [
    ["dirigente", dirigente],
    ["segundo dirigente", segundoDirigente],
    ["explanador", explanador],
    ["leitor", leitor],
  ] as const;

  for (let index = 0; index < sessionRoles.length; index += 1) {
    const [role, name] = sessionRoles[index];
    if (!name?.trim()) continue;

    const duplicatedRole = sessionRoles
      .slice(index + 1)
      .find(([, otherName]) => otherName?.trim() && normalizeName(otherName) === normalizeName(name));

    if (duplicatedRole) {
      return `A mesma pessoa não pode ser ${role} e ${duplicatedRole[0]} na mesma sessão.`;
    }
  }

  for (const [role, name] of [
    ["dirigente", dirigente],
    ["segundo dirigente", segundoDirigente],
  ] as const) {
    if (!name?.trim()) continue;

    if (!isEligibleDirigente(type, name, members, onlyQuadroDeMestre)) {
      return `O ${role} deve ser um membro elegível para este tipo de sessão.`;
    }
  }

  if (explanador?.trim() && !isEligibleExplanador(explanador, members)) {
    return "Membros do Quadro de Sócios não podem ser explanadores.";
  }

  if (mestreAssistente?.trim() && !isEligibleMestreAssistente(mestreAssistente, members)) {
    return "O mestre assistente deve ser um membro do Quadro de Mestre.";
  }

  return null;
}
