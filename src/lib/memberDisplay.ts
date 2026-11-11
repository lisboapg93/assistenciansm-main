export interface MemberDisplayData {
  name: string;
  grau: string | null;
}

// Acentos são ignorados na comparação, alinhado com o índice único
// accent-insensitive do banco (person_name_key) — texto livre digitado em
// sessões (explanador/leitor/dirigente) nem sempre reproduz os acentos do
// cadastro do membro.
export const normalizeName = (name: string) =>
  name
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

// O título faz parte da identidade exibida: João e M. João podem ser
// pessoas diferentes, mas Mestre João e M. João são a mesma identificação.
export function getMemberIdentityKey(name: string) {
  return normalizeName(name)
    .replace(/^(mestre|mestra)\s+/, "m. ")
    .replace(/^(conselheiro|conselheira)\s+/, "c. ")
    .replace(/^([mc])\.\s*/, "$1. ");
}

export const MEMBER_GRAU_OPTIONS = [
  "Quadro de Mestre",
  "Corpo do Conselho",
  "Corpo Instrutivo",
  "Quadro de Sócios",
] as const;

export type MemberGrau = typeof MEMBER_GRAU_OPTIONS[number];

export function isMemberGrau(value: string | null | undefined): value is MemberGrau {
  return (MEMBER_GRAU_OPTIONS as readonly string[]).includes(value ?? "");
}

const GRAU_QUADRO_DE_MESTRE: MemberGrau = "Quadro de Mestre";
const GRAU_CORPO_DO_CONSELHO: MemberGrau = "Corpo do Conselho";

function removeDisplayPrefix(name: string, grau: string | null) {
  if (grau === GRAU_QUADRO_DE_MESTRE) {
    return name.replace(/^(?:(?:mestre|mestra)\s+|m\.\s*)/i, "");
  }
  return name.replace(/^(?:(?:conselheiro|conselheira)\s+|c\.\s*)/i, "");
}

export function usesDegreePrefix(grau: string | null) {
  return grau === GRAU_QUADRO_DE_MESTRE || grau === GRAU_CORPO_DO_CONSELHO;
}

export function getMemberDisplayName(member: MemberDisplayData) {
  if (!usesDegreePrefix(member.grau)) return member.name;

  const prefix = member.grau === GRAU_QUADRO_DE_MESTRE ? "M." : "C.";
  const name = removeDisplayPrefix(member.name, member.grau);

  return `${prefix} ${name}`.trim();
}

export function isMemberName(member: MemberDisplayData, name: string) {
  return getMemberIdentityKey(getMemberDisplayName(member)) === getMemberIdentityKey(name);
}

export function getMemberDisplayNameForValue(
  name: string,
  members: MemberDisplayData[] | undefined,
) {
  const member = members?.find((currentMember) => isMemberName(currentMember, name));
  return member ? getMemberDisplayName(member) : name;
}

/**
 * Procura outro membro com a mesma identificação exibida (nome + título do
 * grau), ignorando o próprio registro em edição.
 */
export function findMemberWithSameIdentity<T extends MemberDisplayData & { id: string }>(
  members: T[] | undefined,
  candidate: MemberDisplayData,
  ignoredId?: string,
): T | undefined {
  const candidateKey = getMemberIdentityKey(getMemberDisplayName(candidate));
  return members?.find((member) =>
    member.id !== ignoredId
    && getMemberIdentityKey(getMemberDisplayName(member)) === candidateKey,
  );
}

/** Busca pelo nome cadastrado ou exibido, ignorando acentos e caixa. */
export function filterMembersBySearch<T extends MemberDisplayData>(
  members: T[] | undefined,
  search: string,
): T[] | undefined {
  const normalizedSearch = normalizeName(search);
  if (!normalizedSearch) return members;

  return members?.filter((member) =>
    normalizeName(member.name).includes(normalizedSearch)
    || normalizeName(getMemberDisplayName(member)).includes(normalizedSearch),
  );
}
