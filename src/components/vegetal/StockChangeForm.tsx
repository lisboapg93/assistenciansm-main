import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateVegetal } from "@/hooks/useVegetais";
import {
  buildMovementDetails,
  validateManualStockChange,
  type ManualStockOperation,
} from "@/lib/stockMovements";
import { formatLiters, parseStockQuantityInput } from "@/lib/stockQuantity";
import type { Vegetal } from "@/types/database";

interface OperationConfig {
  idPrefix: string;
  quantityLabel: string;
  reasonLabel: string;
  reasonPlaceholder: string;
  defaultReason: string;
  submitLabel: string;
  submitVariant: ButtonProps["variant"];
  confirmTitle: string;
  hint: (available: number) => string;
  confirmDescription: (available: number, quantity: number) => string;
}

const OPERATION_CONFIG: Record<ManualStockOperation, OperationConfig> = {
  "Saída": {
    idPrefix: "saida",
    quantityLabel: "Quantidade (L)",
    reasonLabel: "Motivo",
    reasonPlaceholder: "Descarte, doação, etc.",
    defaultReason: "Saída manual de estoque",
    submitLabel: "Registrar Saída",
    submitVariant: "destructive",
    confirmTitle: "Confirmar Saída",
    hint: (available) => `Disponível: ${formatLiters(available)}. Use no máximo 2 casas decimais.`,
    confirmDescription: (_available, quantity) =>
      `Tem certeza que deseja registrar a saída de ${formatLiters(quantity)} do estoque? Esta ação não pode ser desfeita.`,
  },
  "Ajuste": {
    idPrefix: "ajuste",
    quantityLabel: "Nova Quantidade (L)",
    reasonLabel: "Justificativa",
    reasonPlaceholder: "Correção de inventário, erro de medição, etc.",
    defaultReason: "Ajuste/correção de estoque",
    submitLabel: "Aplicar Ajuste",
    submitVariant: "outline",
    confirmTitle: "Confirmar Ajuste",
    hint: (available) => `Atual: ${formatLiters(available)}. Use no máximo 2 casas decimais.`,
    confirmDescription: (available, quantity) =>
      `Tem certeza que deseja ajustar a quantidade de ${formatLiters(available)} para ${formatLiters(quantity)}? Esta ação será registrada no histórico.`,
  },
};

interface StockChangeFormProps {
  operation: ManualStockOperation;
  vegetal: Vegetal;
  onSuccess: () => void;
}

/** Formulário de saída ou ajuste manual de um lote, com confirmação. */
export function StockChangeForm({ operation, vegetal, onSuccess }: StockChangeFormProps) {
  const config = OPERATION_CONFIG[operation];
  const updateVegetal = useUpdateVegetal();
  const [quantityInput, setQuantityInput] = useState("");
  const [reason, setReason] = useState("");
  const [registeredBy, setRegisteredBy] = useState("");

  const availableQuantity = Number(vegetal.quantity);
  const quantity = parseStockQuantityInput(quantityInput);
  const validationError = validateManualStockChange(operation, quantity, availableQuantity);
  const showValidationError = quantityInput.trim() !== "" && validationError !== null;

  const handleConfirm = () => {
    if (updateVegetal.isPending) return;
    if (validationError) {
      toast.error(validationError);
      return;
    }

    updateVegetal.mutate(
      {
        id: vegetal.id,
        quantity,
        expectedQuantity: availableQuantity,
        movementType: operation,
        movementDetails: buildMovementDetails(reason, config.defaultReason, registeredBy),
      },
      { onSuccess },
    );
  };

  const quantityId = `${config.idPrefix}-quantity`;
  const reasonId = `${config.idPrefix}-reason`;
  const registeredById = `${config.idPrefix}-registered-by`;
  const errorId = `${config.idPrefix}-error`;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={quantityId}>{config.quantityLabel}</Label>
        <Input
          id={quantityId}
          type="number"
          step="0.01"
          min="0"
          max={operation === "Saída" ? availableQuantity : undefined}
          inputMode="decimal"
          value={quantityInput}
          onChange={(e) => setQuantityInput(e.target.value)}
          placeholder="Ex: 1.5"
          aria-invalid={showValidationError}
          aria-describedby={showValidationError ? errorId : undefined}
        />
        <p className="text-xs text-muted-foreground">{config.hint(availableQuantity)}</p>
        {showValidationError && (
          <p id={errorId} className="text-xs text-destructive" role="alert">
            {validationError}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={reasonId}>{config.reasonLabel}</Label>
        <Textarea
          id={reasonId}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={config.reasonPlaceholder}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={registeredById}>Registrado por</Label>
        <Input
          id={registeredById}
          value={registeredBy}
          onChange={(e) => setRegisteredBy(e.target.value)}
          placeholder="Nome de quem está registrando"
        />
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant={config.submitVariant}
            className="w-full"
            disabled={updateVegetal.isPending || validationError !== null}
          >
            {config.submitLabel}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{config.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {config.confirmDescription(availableQuantity, quantity)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={updateVegetal.isPending}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
