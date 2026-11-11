import { isStockQuantity, sumStockQuantities } from "@/lib/stockQuantity";
import type { ConsumptionSource, Vegetal } from "@/types/database";

export interface ConsumptionValidationInput {
  sources: ConsumptionSource[];
  isUnited: boolean;
  totalConsumed: number;
  totalAvailable: number;
  hasSourceQuantityMismatch: boolean;
}

export function getConsumptionValidationError(
  { sources, isUnited, totalConsumed, totalAvailable, hasSourceQuantityMismatch }: ConsumptionValidationInput,
  context: "step" | "submit",
): string | null {
  const isSubmit = context === "submit";
  if (sources.length === 0) return isSubmit ? "Selecione pelo menos um vegetal" : "Selecione ao menos um lote de vegetal.";
  if (!isUnited && sources.length !== 1) return isSubmit ? "Selecione apenas um vegetal quando não houver união" : "Sem união, selecione apenas um lote.";

  const quantityInvalid = sources.some((source) => !isStockQuantity(source.amount_available));
  if (isSubmit && quantityInvalid) return "Informe quantidades positivas com no máximo 2 casas decimais para cada vegetal.";
  if (hasSourceQuantityMismatch) return isSubmit
    ? "Um lote mudou de saldo. Desmarque e selecione-o novamente antes de salvar."
    : "Um lote mudou de saldo. Desmarque e selecione-o novamente.";
  if (quantityInvalid) return "Informe quantidades positivas com até duas casas decimais.";
  if (!isStockQuantity(totalConsumed)) return isSubmit
    ? "Informe consumo positivo com no máximo 2 casas decimais."
    : "Informe consumo positivo com até duas casas decimais.";
  if (totalConsumed > totalAvailable) return isSubmit ? "Consumo maior que disponível" : "Consumo maior que saldo disponível.";
  return null;
}

/**
 * Compara as quantidades escolhidas com o saldo atual de cada lote. Um lote
 * que perdeu saldo desde a seleção (ou sumiu da lista) só contribui até o que
 * ainda existe, e a divergência é sinalizada para o usuário reselecioná-lo.
 */
export function getConsumptionAvailability(
  sources: ConsumptionSource[],
  vegetais: Pick<Vegetal, "id" | "quantity">[],
) {
  const quantityById = new Map(vegetais.map((vegetal) => [vegetal.id, Number(vegetal.quantity)]));
  const sourceQuantities = sources.map((source) => ({
    source,
    currentQuantity: quantityById.get(source.vegetal_id) ?? 0,
  }));

  return {
    totalAvailable: sumStockQuantities(sourceQuantities.map(({ source, currentQuantity }) =>
      Math.min(source.amount_available, currentQuantity),
    )),
    hasSourceQuantityMismatch: sourceQuantities.some(({ source, currentQuantity }) =>
      source.amount_available > currentQuantity,
    ),
  };
}
