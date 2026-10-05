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
