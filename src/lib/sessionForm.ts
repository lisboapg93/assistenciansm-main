import { TYPES_WITH_EXPLANADOR_LEITOR } from "@/types/database";
import type { ConsumptionSource, Participants, Session } from "@/types/database";
import { getMemberIdentityKey } from "@/lib/memberDisplay";
import {
  allowsTransmission,
  areParticipantsValid,
  formatTransmissionObservation,
  parseTransmissionObservation,
  sumParticipants,
} from "@/lib/sessionData";
import {
  getSessionRoleEligibilityChecks,
  getSessionRoleValidationError,
  isEligibleDirigente,
  isEligibleExplanador,
  isEligibleMestreAssistente,
} from "@/lib/sessionRoleEligibility";
import type { MemberRoleData, SessionRoleEligibilityChecks } from "@/lib/sessionRoleEligibility";
import type { SessionRegistrationInput } from "@/lib/sessionRegistration";

/** Campos de identificação e funções da sessão, como editados no formulário. */
export interface SessionBasicData {
  date: string;
  type: string;
  is_transmissao_assistencia: boolean;
  segundo_dirigente: string;
  dirigente: string;
  explanador: string;
  leitor: string;
  mestre_assistente: string;
  registered_by_name: string;
}

export interface SessionContentData {
  has_photo: boolean;
  has_audio: boolean;
  observation: string;
}

export interface SessionConsumptionData {
  /** Texto do campo, convertido só na validação para não perder o que foi digitado. */
  total_consumed: string;
  is_united: boolean;
  sources: ConsumptionSource[];
}

/** Campos aceitos pela RPC update_session_metadata. */
export type EditableSessionFields = Partial<Pick<Session,
  "date" | "type" | "dirigente" | "explanador" | "leitor" |
  "mestre_assistente" | "observation" | "participants" |
  "total_participants" | "has_photo" | "has_audio"
>>;

export const PARTICIPANTS_VALIDATION_MESSAGE =
  "Informe ao menos um participante e use quantidades inteiras não negativas.";

export const EMPTY_CONTENT_DATA: Readonly<SessionContentData> = {
  has_photo: false,
  has_audio: false,
  observation: "",
};

export const EMPTY_CONSUMPTION_DATA: Readonly<SessionConsumptionData> = {
  total_consumed: "",
  is_united: false,
  sources: [],
};

export function createEmptyBasicData(date = ""): SessionBasicData {
  return {
    date,
    type: "",
    is_transmissao_assistencia: false,
    segundo_dirigente: "",
    dirigente: "",
    explanador: "",
    leitor: "",
    mestre_assistente: "",
    registered_by_name: "",
  };
}

export const requiresExplanadorLeitor = (type: string) => TYPES_WITH_EXPLANADOR_LEITOR.includes(type);

const isBlank = (value: string) => value.trim().length === 0;

/**
 * Valores que a sessão realmente terá ao salvar: aparados e sem os campos que
 * o tipo ou a transmissão não usam (o formulário conserva o rascunho deles).
 */
export function getEffectiveRoles(data: SessionBasicData) {
  const withExplanadorLeitor = requiresExplanadorLeitor(data.type);
  return {
    dirigente: data.dirigente.trim(),
    segundoDirigente: data.is_transmissao_assistencia ? data.segundo_dirigente.trim() : null,
    explanador: withExplanadorLeitor ? data.explanador.trim() : null,
    leitor: withExplanadorLeitor ? data.leitor.trim() : null,
    mestreAssistente: data.mestre_assistente.trim(),
  };
}

type EffectiveRoles = ReturnType<typeof getEffectiveRoles>;

export function getSessionMemberNames(roles: EffectiveRoles): string[] {
  return [roles.dirigente, roles.segundoDirigente, roles.mestreAssistente, roles.explanador]
    .filter((name): name is string => Boolean(name));
}

interface SessionFormValidationContext {
  members: MemberRoleData[];
  /** A edição não altera quem registrou; o cadastro exige o campo. */
  requireRegisteredBy: boolean;
  /** Na edição, só revalida funções que mudaram (dados históricos são preservados). */
  eligibilityChecks?: SessionRoleEligibilityChecks;
}

function getRoleValidationError(data: SessionBasicData, context: SessionFormValidationContext) {
  const roles = getEffectiveRoles(data);
  return getSessionRoleValidationError({
    type: data.type,
    dirigente: roles.dirigente,
    segundoDirigente: roles.segundoDirigente ?? undefined,
    explanador: roles.explanador ?? undefined,
    leitor: roles.leitor ?? undefined,
    mestreAssistente: roles.mestreAssistente,
    onlyQuadroDeMestre: data.is_transmissao_assistencia,
    validateEligibility: context.eligibilityChecks,
    members: context.members,
  });
}

const isMissingRequiredField = (data: SessionBasicData, requireRegisteredBy: boolean) =>
  !data.date || !data.type || isBlank(data.dirigente) || isBlank(data.mestre_assistente)
  || (requireRegisteredBy && isBlank(data.registered_by_name));

const isMissingExplanadorLeitor = (data: SessionBasicData) =>
  requiresExplanadorLeitor(data.type) && (isBlank(data.explanador) || isBlank(data.leitor));

const isInvalidTransmission = (data: SessionBasicData) =>
  data.is_transmissao_assistencia && (!allowsTransmission(data.type) || isBlank(data.segundo_dirigente));

/** Mensagem exibida sob o passo "Dados Básicos" enquanto ele não pode avançar. */
export function getBasicDataStepMessage(data: SessionBasicData, context: SessionFormValidationContext) {
  if (isMissingRequiredField(data, context.requireRegisteredBy)) {
    return context.requireRegisteredBy
      ? "Preencha tipo, data, dirigente, mestre assistente e quem registrou."
      : "Preencha tipo, data, dirigente e mestre assistente.";
  }
  if (isMissingExplanadorLeitor(data)) return "Este tipo exige explanador e leitor.";
  if (isInvalidTransmission(data)) return "A transmissão exige segundo dirigente.";
  return getRoleValidationError(data, context);
}

/** Primeiro erro que impede salvar a sessão (dados básicos e participantes). */
export function getSessionFormError(
  data: SessionBasicData,
  participants: Participants,
  context: SessionFormValidationContext,
) {
  if (isMissingRequiredField(data, context.requireRegisteredBy)) return "Preencha os campos obrigatórios";
  if (isMissingExplanadorLeitor(data)) return "Explanador e Leitor são obrigatórios para este tipo de sessão";
  if (isInvalidTransmission(data)) return "A transmissão exige um tipo permitido e o segundo dirigente.";
  if (!areParticipantsValid(participants)) return PARTICIPANTS_VALIDATION_MESSAGE;
  return getRoleValidationError(data, context);
}

/** Destaque visual dos campos de função preenchidos com membros inelegíveis. */
export function getInvalidRoleFields(
  data: SessionBasicData,
  members: MemberRoleData[],
  eligibilityChecks?: SessionRoleEligibilityChecks,
) {
  const shouldCheck = (role: keyof SessionRoleEligibilityChecks) => eligibilityChecks?.[role] ?? true;
  const onlyQuadroDeMestre = data.is_transmissao_assistencia;

  return {
    dirigente: shouldCheck("dirigente")
      && !isEligibleDirigente(data.type, data.dirigente, members, onlyQuadroDeMestre),
    segundoDirigente: shouldCheck("segundoDirigente")
      && !isEligibleDirigente(data.type, data.segundo_dirigente, members, onlyQuadroDeMestre),
    mestreAssistente: shouldCheck("mestreAssistente")
      && !isEligibleMestreAssistente(data.mestre_assistente, members),
    explanador: shouldCheck("explanador")
      && !isEligibleExplanador(data.explanador, members),
  };
}

export type InvalidRoleFields = ReturnType<typeof getInvalidRoleFields>;

function buildObservation(roles: EffectiveRoles, content: SessionContentData) {
  return formatTransmissionObservation(roles.segundoDirigente, content.observation.trim()) || null;
}

export function buildSessionRegistration(
  data: SessionBasicData,
  content: SessionContentData,
  participants: Participants,
  consumption: { totalConsumed: number; isUnited: boolean },
): SessionRegistrationInput {
  const roles = getEffectiveRoles(data);
  return {
    date: data.date,
    type: data.type,
    dirigente: roles.dirigente,
    explanador: roles.explanador,
    leitor: roles.leitor,
    mestre_assistente: roles.mestreAssistente || null,
    registered_by_name: data.registered_by_name.trim(),
    has_photo: content.has_photo,
    has_audio: content.has_audio,
    observation: buildObservation(roles, content),
    participants,
    total_participants: sumParticipants(participants),
    total_consumed: consumption.totalConsumed,
    is_united: consumption.isUnited,
  };
}

const isSameRoleValue = (current: string | null | undefined, original: string | null | undefined) =>
  getMemberIdentityKey(current || "") === getMemberIdentityKey(original || "");

/**
 * Monta a atualização da sessão. Funções cuja identidade não mudou não são
 * enviadas, para preservar a grafia histórica gravada na época da sessão.
 */
export function buildSessionUpdates(
  data: SessionBasicData,
  content: SessionContentData,
  participants: Participants,
  original: Session,
): EditableSessionFields {
  const roles = getEffectiveRoles(data);
  return {
    date: data.date,
    type: data.type,
    has_photo: content.has_photo,
    has_audio: content.has_audio,
    observation: buildObservation(roles, content),
    participants,
    total_participants: sumParticipants(participants),
    ...(isSameRoleValue(roles.dirigente, original.dirigente) ? {} : { dirigente: roles.dirigente }),
    ...(isSameRoleValue(roles.explanador, original.explanador) ? {} : { explanador: roles.explanador }),
    ...(isSameRoleValue(roles.leitor, original.leitor) ? {} : { leitor: roles.leitor }),
    ...(isSameRoleValue(roles.mestreAssistente, original.mestre_assistente)
      ? {}
      : { mestre_assistente: roles.mestreAssistente }),
  };
}

/** Converte uma sessão gravada para o estado inicial do formulário de edição. */
export function sessionToFormState(session: Session) {
  const transmission = parseTransmissionObservation(session.observation || "");
  const hasTransmission = transmission.segundoDirigente !== null && allowsTransmission(session.type);

  return {
    basicData: {
      // session.date guarda o dia calendário à meia-noite UTC; fatiar evita
      // que a conversão para o fuso local mostre o dia anterior.
      date: session.date.slice(0, 10),
      type: session.type,
      is_transmissao_assistencia: hasTransmission,
      segundo_dirigente: hasTransmission ? transmission.segundoDirigente : "",
      dirigente: session.dirigente,
      explanador: session.explanador || "",
      leitor: session.leitor || "",
      mestre_assistente: session.mestre_assistente || "",
      registered_by_name: session.registered_by_name || "",
    } satisfies SessionBasicData,
    contentData: {
      has_photo: session.has_photo,
      has_audio: session.has_audio,
      observation: transmission.observation,
    } satisfies SessionContentData,
    participants: session.participants,
  };
}

/** Quais funções precisam ser revalidadas na edição, comparando com a sessão gravada. */
export function getSessionEditEligibilityChecks(data: SessionBasicData, original: Session) {
  const roles = getEffectiveRoles(data);
  const originalTransmission = parseTransmissionObservation(original.observation || "");

  return getSessionRoleEligibilityChecks({
    type: data.type,
    isTransmissaoAssistencia: data.is_transmissao_assistencia,
    dirigente: roles.dirigente,
    segundoDirigente: roles.segundoDirigente ?? "",
    explanador: roles.explanador,
    leitor: roles.leitor,
    mestreAssistente: roles.mestreAssistente,
  }, {
    type: original.type,
    isTransmissaoAssistencia: originalTransmission.segundoDirigente !== null,
    dirigente: original.dirigente,
    segundoDirigente: originalTransmission.segundoDirigente || "",
    explanador: original.explanador,
    leitor: original.leitor,
    mestreAssistente: original.mestre_assistente,
  });
}
