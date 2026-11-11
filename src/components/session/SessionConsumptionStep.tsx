import type { Dispatch, SetStateAction } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toggleSessionSource } from "@/lib/sessionSourceSelection";
import type { ConsumptionSource, Vegetal } from "@/types/database";

export interface SessionConsumptionData {
  total_consumed: string;
  is_united: boolean;
  sources: ConsumptionSource[];
}

export function SessionConsumptionStep({ vegetais, consumptionData, setConsumptionData, totalAvailable }: {
  vegetais: Vegetal[] | undefined;
  consumptionData: SessionConsumptionData;
  setConsumptionData: Dispatch<SetStateAction<SessionConsumptionData>>;
  totalAvailable: number;
}) {
  const vegetalById = new Map((vegetais || []).map((vegetal) => [vegetal.id, vegetal]));
  const selectableVegetais = [
    ...(vegetais || []).filter((vegetal) =>
      Number(vegetal.quantity) > 0 || consumptionData.sources.some((source) => source.vegetal_id === vegetal.id),
    ),
    ...consumptionData.sources
      .filter((source) => !vegetalById.has(source.vegetal_id))
      .map((source) => ({ id: source.vegetal_id, name: source.vegetal_name, quantity: 0 })),
  ];

  const handleAddSource = (vegetalId: string) => {
    const sources = toggleSessionSource(consumptionData.sources, vegetalId, vegetais || []);
    if (sources !== consumptionData.sources) setConsumptionData({ ...consumptionData, sources });
  };

  const handleSourceAmountChange = (vegetalId: string, amount: number) => {
    setConsumptionData({
      ...consumptionData,
      sources: consumptionData.sources.map((s) =>
        s.vegetal_id === vegetalId ? { ...s, amount_available: amount } : s
      ),
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Selecionar Vegetais</Label>
          <div className="flex items-center gap-2">
            <Switch
              id="is_united"
              checked={consumptionData.is_united}
              onCheckedChange={(checked) => {
                if (checked) {
                  setConsumptionData({ ...consumptionData, is_united: true });
                  return;
                }

                const firstSource = consumptionData.sources[0];
                const vegetal = firstSource ? vegetalById.get(firstSource.vegetal_id) : undefined;
                setConsumptionData({
                  ...consumptionData,
                  is_united: false,
                  sources: firstSource
                    ? [{ ...firstSource, amount_available: vegetal ? Number(vegetal.quantity) : 0 }]
                    : [],
                });
              }}
            />
            <Label htmlFor="is_united" className="text-sm">
              Vegetal Unido
            </Label>
          </div>
        </div>

        <div className="grid gap-2 max-h-48 overflow-y-auto">
          {selectableVegetais.map((vegetal) => {
              const isSelected = consumptionData.sources.some(
                (s) => s.vegetal_id === vegetal.id
              );
              const source = consumptionData.sources.find(
                (s) => s.vegetal_id === vegetal.id
              );

              return (
                <div
                  key={vegetal.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  )}
                  onClick={() => handleAddSource(vegetal.id)}
                >
                  <Checkbox checked={isSelected} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{vegetal.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Disponível: {Number(vegetal.quantity).toFixed(2)} L
                      {isSelected && Number(vegetal.quantity) <= 0 ? " — desmarque este lote" : ""}
                    </p>
                  </div>
                  {isSelected && consumptionData.is_united && (
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max={vegetal.quantity}
                      value={source?.amount_available || ""}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        handleSourceAmountChange(
                          vegetal.id,
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-24"
                      placeholder="Qtd"
                    />
                  )}
                </div>
              );
          })}
        </div>
      </div>

      {consumptionData.sources.length > 0 && (
        <div className="space-y-4 p-4 rounded-lg bg-muted/50">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Total disponibilizado:
            </span>
            <span className="font-medium">
              {totalAvailable.toFixed(2)} L
            </span>
          </div>

          <div className="space-y-2">
            <Label>
              Total Consumido (L){" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max={totalAvailable}
              value={consumptionData.total_consumed}
              onChange={(e) =>
                setConsumptionData({
                  ...consumptionData,
                  total_consumed: e.target.value,
                })
              }
              placeholder="Ex: 2.5"
            />
          </div>

          {consumptionData.is_united &&
            parseFloat(consumptionData.total_consumed) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Saldo (novo vegetal):
                </span>
                <span className="font-medium text-primary">
                  {(
                    totalAvailable -
                    parseFloat(consumptionData.total_consumed || "0")
                  ).toFixed(2)}{" "}
                  L
                </span>
              </div>
            )}

        </div>
      )}
    </div>
  );
}
