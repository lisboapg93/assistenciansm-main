import { SESSION_TYPES, TYPES_WITH_EXPLANADOR_LEITOR } from "@/types/database";
import type { ConsumptionSource, Participants, Vegetal } from "@/types/database";
import { getSessionRoleValidationError } from "@/lib/sessionRoleEligibility";
import type { MemberRoleData } from "@/lib/sessionRoleEligibility";
import { isStockQuantity, sumStockQuantities } from "@/lib/stockQuantity";
import { allowsTransmission, areParticipantsValid, MAX_PARTICIPANTS } from "@/lib/sessionData";

export interface ParsedSession {
  rowNumber: number;
  date: string;
  type: string;
  is_transmissao_assistencia: boolean;
  segundo_dirigente?: string;
  dirigente: string;
  mestre_assistente: string;
  registered_by_name: string;
  explanador?: string;
  leitor?: string;
  mestres: number;
  conselheiros: number;
  instrutivo: number;
  socios: number;
  visitantes: number;
  jovens: number;
  total_consumed: number;
  is_united: boolean;
  has_photo: boolean;
  has_audio: boolean;
  observation?: string;
  sources: ConsumptionSource[];
  isValid: boolean;
  errors: string[];
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const parseBoolean = (value: string): boolean | null => {
  const normalized = value?.toLowerCase().trim();
  if (!normalized || ["false", "não", "nao", "falso", "0", "n"].includes(normalized)) return false;
  if (["true", "sim", "verdadeiro", "1", "s"].includes(normalized)) return true;
  return null;
};

const parseNumber = (value: string): number | null => {
  const trimmed = value?.trim() || "";
  if (!trimmed) return null;
  const normalized = /^\d{1,3}(?:\.\d{3})+,\d+$/.test(trimmed)
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed.replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
};

const parseDate = (value: string): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  let year: number;
  let month: number;
  let day: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  const brazilian = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
  if (iso) {
    year = Number(iso[1]); month = Number(iso[2]); day = Number(iso[3]);
  } else if (brazilian) {
    day = Number(brazilian[1]); month = Number(brazilian[2]); year = Number(brazilian[3]);
  } else {
    return null;
  }
  const result = new Date(Date.UTC(year, month - 1, day));
  if (result.getUTCFullYear() !== year || result.getUTCMonth() !== month - 1 || result.getUTCDate() !== day) return null;
  return `${year.toString().padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

export const validateSessionCsvRow = (
  row: Record<string, string>,
  members: MemberRoleData[],
  vegetais: Pick<Vegetal, "id" | "name" | "quantity">[],
): ParsedSession => {
  const errors: string[] = [];

  const date = parseDate(row.data);
  if (!date) {
    errors.push("Data inválida");
  }

  const importedType = row.tipo?.trim() || "";
  const type = SESSION_TYPES.find((sessionType) =>
    sessionType.localeCompare(importedType, "pt-BR", { sensitivity: "base" }) === 0,
  ) || "";
  if (!type) {
    errors.push(`Tipo de sessão inválido: "${importedType}"`);
  }

  const dirigente = row.dirigente?.trim() || "";
  if (!dirigente) {
    errors.push("Dirigente é obrigatório");
  }

  const mestreAssistente = row.mestre_assistente?.trim() || "";
  if (!mestreAssistente) {
    errors.push("Mestre Assistente é obrigatório");
  }

  const registeredByName = row.registrado_por?.trim() || "";
  if (!registeredByName) {
    errors.push("Registrado por é obrigatório");
  }

  const explanador = row.explanador?.trim() || "";
  const leitor = row.leitor?.trim() || "";
  const isTransmissaoAssistencia = parseBoolean(row.transmissao_assistencia);
  const segundoDirigente = row.segundo_dirigente?.trim() || "";
  const typeAllowsTransmissao = allowsTransmission(type);
  if (isTransmissaoAssistencia === null) errors.push("transmissao_assistencia: use sim ou não");
  if (isTransmissaoAssistencia && (!typeAllowsTransmissao || !segundoDirigente)) {
    errors.push("A transmissão exige tipo permitido e segundo dirigente");
  }
  if (TYPES_WITH_EXPLANADOR_LEITOR.includes(type) && (!explanador || !leitor)) {
    errors.push("Explanador e Leitor são obrigatórios para este tipo de sessão");
  }

  if (dirigente && mestreAssistente && type) {
    const roleError = getSessionRoleValidationError({
      type,
      dirigente,
      segundoDirigente: isTransmissaoAssistencia ? segundoDirigente : undefined,
      mestreAssistente,
      explanador: explanador || undefined,
      leitor: leitor || undefined,
      onlyQuadroDeMestre: isTransmissaoAssistencia === true,
      members,
    });
    if (roleError) errors.push(roleError);
  }

  const countFields = ["mestres", "conselheiros", "instrutivo", "socios", "visitantes", "jovens"] as const;
  const counts = Object.fromEntries(countFields.map((field) => {
    const value = row[field]?.trim() ? parseNumber(row[field]) : 0;
    if (value === null || !Number.isInteger(value) || value < 0) {
      errors.push(`${field}: informe um inteiro não negativo`);
      return [field, 0];
    }
    return [field, value];
  })) as Record<(typeof countFields)[number], number>;
  if (!areParticipantsValid(counts as Participants)) {
    errors.push(`Informe de 1 a ${MAX_PARTICIPANTS.toLocaleString("pt-BR")} participantes inteiros não negativos`);
  }

  const totalConsumed = parseNumber(row.consumo_total);
  if (totalConsumed === null || !isStockQuantity(totalConsumed)) errors.push("Consumo deve ser positivo com no máximo 2 casas decimais");

  const isUnited = parseBoolean(row.vegetal_unido);
  const hasPhoto = parseBoolean(row.tem_foto);
  const hasAudio = parseBoolean(row.tem_audio);
  if (isUnited === null) errors.push("vegetal_unido: use sim ou não");
  if (hasPhoto === null) errors.push("tem_foto: use sim ou não");
  if (hasAudio === null) errors.push("tem_audio: use sim ou não");

  const sources: ConsumptionSource[] = [];
  const sourceText = row.fontes_vegetal?.trim() || "";
  if (!sourceText) {
    errors.push("Informe os lotes de vegetal usados no consumo");
  } else {
    const entries = sourceText.split("|");
    if (isUnited === false && entries.length !== 1) {
      errors.push("Sem união, informe apenas um lote");
    }
    const seen = new Set<string>();
    for (const entry of entries) {
      const [id, rawAmount, extra] = entry.trim().split(":");
      const vegetalId = id?.trim() || "";
      if (!UUID_PATTERN.test(vegetalId) || extra !== undefined || seen.has(vegetalId)) {
        errors.push(`Fonte de vegetal inválida ou repetida: ${entry}`);
        continue;
      }
      seen.add(vegetalId);
      const vegetal = vegetais.find((lot) => lot.id === vegetalId);
      if (!vegetal) {
        errors.push(`Lote indisponível: ${vegetalId}`);
        continue;
      }
      const amount = rawAmount?.trim()
        ? parseNumber(rawAmount)
        : isUnited ? null : totalConsumed;
      if (amount === null || amount === undefined || !isStockQuantity(amount) || amount > Number(vegetal.quantity)) {
        errors.push(`Quantidade inválida para o lote ${vegetal.name}`);
        continue;
      }
      sources.push({ vegetal_id: vegetal.id, vegetal_name: vegetal.name, amount_available: amount });
    }
    if (totalConsumed !== null && sumStockQuantities(sources.map((source) => source.amount_available)) < totalConsumed) {
      errors.push("Consumo maior que o total disponibilizado pelos lotes");
    }
  }

  return {
    rowNumber: 0,
    date: date || "",
    type,
    is_transmissao_assistencia: isTransmissaoAssistencia ?? false,
    segundo_dirigente: segundoDirigente || undefined,
    dirigente,
    mestre_assistente: mestreAssistente,
    registered_by_name: registeredByName,
    explanador: explanador || undefined,
    leitor: leitor || undefined,
    ...counts,
    total_consumed: totalConsumed ?? 0,
    is_united: isUnited ?? false,
    has_photo: hasPhoto ?? false,
    has_audio: hasAudio ?? false,
    observation: row.observacao?.trim() || undefined,
    sources,
    isValid: errors.length === 0,
    errors,
  };
};
