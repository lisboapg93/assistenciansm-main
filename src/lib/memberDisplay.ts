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
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

const GRAU_QUADRO_DE_MESTRE = "Quadro de Mestre";
const GRAU_CORPO_DO_CONSELHO = "Corpo do Conselho";

function removeDisplayPrefix(name: string, grau: string | null) {
  if (grau === GRAU_QUADRO_DE_MESTRE) {
    return name.replace(/^(mestre|m\.)\s*/i, "");
  }
  return name.replace(/^(conselheiro|conselheira|c\.)\s*/i, "");
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
  const normalizedName = normalizeName(name);
  return [member.name, getMemberDisplayName(member)].some(
    (memberName) => normalizeName(memberName) === normalizedName,
  );
}

export function getMemberDisplayNameForValue(
  name: string,
  members: MemberDisplayData[] | undefined,
) {
  const member = members?.find((currentMember) => isMemberName(currentMember, name));
  return member ? getMemberDisplayName(member) : name;
}
