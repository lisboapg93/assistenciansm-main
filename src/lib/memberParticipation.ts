import { getMemberDisplayName, isMemberName } from "@/lib/memberDisplay";
import type { Member } from "@/hooks/useMembers";
import type { Session } from "@/types/database";

export function getMembersWithoutParticipation<T extends Pick<Member, "name" | "grau" | "is_socio_nucleo">>(
  members: T[] | undefined,
  sessions: Pick<Session, "explanador" | "leitor">[] | undefined,
) {
  const sociosNucleo = members?.filter((member) => member.is_socio_nucleo) || [];
  const explanadores: string[] = [];
  const leitores: string[] = [];
  sessions?.forEach((session) => {
    if (session.explanador) explanadores.push(session.explanador);
    if (session.leitor) leitores.push(session.leitor);
  });

  const byDisplayName = (a: T, b: T) =>
    getMemberDisplayName(a).localeCompare(getMemberDisplayName(b), "pt-BR");
  return {
    naoExplanaram: sociosNucleo.filter((member) =>
      !explanadores.some((name) => isMemberName(member, name)),
    ).sort(byDisplayName),
    naoLeram: sociosNucleo.filter((member) =>
      !leitores.some((name) => isMemberName(member, name)),
    ).sort(byDisplayName),
  };
}
