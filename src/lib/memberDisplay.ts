export interface MemberDisplayData {
  name: string;
  grau: string | null;
  chosen_name?: string | null;
}

const normalizeName = (name: string) => name.trim().toLocaleLowerCase("pt-BR");

const GRAU_QUADRO_DE_MESTRE = "Quadro de Mestre";
const GRAU_CORPO_DO_CONSELHO = "Corpo do Conselho";

function removeTitle(chosenName: string, grau: string) {
  if (grau === GRAU_QUADRO_DE_MESTRE) {
    return chosenName.replace(/^(mestr[eo]|m\.)\s*/i, "");
  }

  return chosenName.replace(/^(conselheir[oa]|c\.)\s*/i, "");
}

function removeDisplayPrefix(name: string) {
  return name.replace(/^[mc]\.\s+/i, "");
}

export function usesChosenName(grau: string | null) {
  return grau === GRAU_QUADRO_DE_MESTRE || grau === GRAU_CORPO_DO_CONSELHO;
}

export function getMemberDisplayName(member: MemberDisplayData) {
  const chosenName = member.chosen_name?.trim();
  if (!usesChosenName(member.grau)) return member.name;

  const prefix = member.grau === GRAU_QUADRO_DE_MESTRE ? "M." : "C.";
  const name = chosenName
    ? removeTitle(chosenName, member.grau)
    : removeDisplayPrefix(member.name);

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
