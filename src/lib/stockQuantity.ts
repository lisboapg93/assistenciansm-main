export const MAX_STOCK_QUANTITY = 99999999.99;

export function isStockQuantity(value: number, allowZero = false): boolean {
  return Number.isFinite(value)
    && (allowZero ? value >= 0 : value > 0)
    && value <= MAX_STOCK_QUANTITY
    && value === Number(value.toFixed(2));
}

// Somar centilitros inteiros evita que 0,10 + 0,20 seja maior que 0,30.
export function sumStockQuantities(values: number[]): number {
  return values.reduce((sum, value) => sum + Math.round(value * 100), 0) / 100;
}

/**
 * Converte o valor de um campo de quantidade. Campo vazio vira NaN (e não 0,
 * como faria `Number("")`), para que a validação o trate como inválido.
 */
export function parseStockQuantityInput(value: string): number {
  const trimmed = value.trim();
  return trimmed === "" ? Number.NaN : Number(trimmed);
}

export function getTotalStock(lots: ReadonlyArray<{ quantity: number }> | undefined): number {
  return sumStockQuantities(lots?.map((lot) => Number(lot.quantity)) ?? []);
}

export function formatLiters(value: number, fractionDigits = 2): string {
  return `${Number(value).toFixed(fractionDigits)} L`;
}
