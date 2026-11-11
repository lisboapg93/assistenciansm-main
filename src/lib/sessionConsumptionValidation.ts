import { isStockQuantity } from "@/lib/stockQuantity";
import type { ConsumptionSource } from "@/types/database";

interface ConsumptionValidationInput {
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
