import type { ConsumptionSource, Vegetal } from "@/types/database";

type AvailableVegetal = Pick<Vegetal, "id" | "name" | "quantity">;

export function toggleSessionSource(
  sources: ConsumptionSource[],
  vegetalId: string,
  vegetais: AvailableVegetal[],
): ConsumptionSource[] {
  if (sources.some((source) => source.vegetal_id === vegetalId)) {
    return sources.filter((source) => source.vegetal_id !== vegetalId);
  }

  const vegetal = vegetais.find((item) => item.id === vegetalId);
  if (!vegetal) return sources;

  return [...sources, {
    vegetal_id: vegetal.id,
    vegetal_name: vegetal.name,
    amount_available: Number(vegetal.quantity),
  }];
}
