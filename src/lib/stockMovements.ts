import { isStockQuantity } from "@/lib/stockQuantity";
import type { MovementType, StockMovement } from "@/types/database";

/** Movimentações registradas manualmente no lote (change_vegetal_stock). */
export type ManualStockOperation = Extract<MovementType, "Saída" | "Ajuste">;

const toCentiliters = (value: number) => Math.round(value * 100);

export function isIncomingMovement(type: MovementType): boolean {
  return type === "Entrada" || type === "Saldo";
}

export function isOutgoingMovement(type: MovementType): boolean {
  return type === "Saída" || type === "Consumo";
}

/**
 * Efeito da movimentação no saldo do lote. Em "Ajuste" o banco grava
 * `saldo anterior - novo saldo` (change_vegetal_stock): valor positivo reduz o
 * estoque e negativo o aumenta.
 */
export function getMovementEffect(type: MovementType, quantity: number): number {
  if (isIncomingMovement(type)) return Math.abs(quantity);
  if (type === "Ajuste") return -quantity;
  return -Math.abs(quantity);
}

export type StockMovementWithBalance = StockMovement & { effect: number; balance: number };

/**
 * Reconstrói o saldo após cada movimentação partindo do saldo atual do lote e
 * voltando no tempo. A conta é feita em centilitros para não acumular erro de
 * ponto flutuante ao longo do histórico.
 */
export function getMovementsWithBalance(
  movements: StockMovement[] | undefined,
  currentQuantity: number,
): StockMovementWithBalance[] {
  if (!movements) return [];

  let balanceAfterMovement = toCentiliters(Number(currentQuantity || 0));
  const reverseChronological = [...movements].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return reverseChronological.map((movement) => {
    const effect = getMovementEffect(movement.type, Number(movement.quantity));
    const withBalance = { ...movement, effect, balance: Math.max(0, balanceAfterMovement) / 100 };
    balanceAfterMovement -= toCentiliters(effect);
    return withBalance;
  });
}

/**
 * Valida uma saída (quantidade retirada) ou ajuste (novo saldo) contra o saldo
 * atual do lote, com as mesmas regras de change_vegetal_stock. Retorna a
 * mensagem de erro ou `null` quando a operação é válida.
 */
export function validateManualStockChange(
  operation: ManualStockOperation,
  quantity: number,
  availableQuantity: number,
): string | null {
  if (operation === "Saída") {
    if (!isStockQuantity(quantity)) return "Informe quantidade positiva com no máximo 2 casas decimais.";
    if (quantity > availableQuantity) return "A quantidade informada é maior que o saldo disponível.";
    return null;
  }

  if (!isStockQuantity(quantity, true)) return "Informe quantidade válida com no máximo 2 casas decimais.";
  if (quantity === availableQuantity) return "A nova quantidade deve ser diferente do saldo atual.";
  return null;
}

export function buildMovementDetails(reason: string, defaultReason: string, registeredBy: string): string {
  const trimmedReason = reason.trim() || defaultReason;
  const trimmedRegisteredBy = registeredBy.trim();
  return trimmedRegisteredBy
    ? `${trimmedReason} - Registrado por: ${trimmedRegisteredBy}`
    : trimmedReason;
}
