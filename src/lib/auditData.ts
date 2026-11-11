export type AuditData = Record<string, unknown>;
type AuditChange = {
  field: string;
  oldValue: unknown;
  newValue: unknown;
};

const auditTechnicalFields = new Set(["id", "created_at", "updated_at"]);

export function isAuditData(value: unknown): value is AuditData {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function areAuditValuesEqual(firstValue: unknown, secondValue: unknown): boolean {
  if (Object.is(firstValue, secondValue)) return true;

  if (Array.isArray(firstValue) && Array.isArray(secondValue)) {
    return firstValue.length === secondValue.length
      && firstValue.every((value, index) => areAuditValuesEqual(value, secondValue[index]));
  }

  if (isAuditData(firstValue) && isAuditData(secondValue)) {
    const firstKeys = Object.keys(firstValue);
    const secondKeys = Object.keys(secondValue);

    return firstKeys.length === secondKeys.length
      && firstKeys.every((key) => (
        Object.prototype.hasOwnProperty.call(secondValue, key)
        && areAuditValuesEqual(firstValue[key], secondValue[key])
      ));
  }

  return false;
}

export function getAuditChanges(oldData: AuditData, newData: AuditData): AuditChange[] {
  const fields = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

  return [...fields]
    .filter((field) => !auditTechnicalFields.has(field))
    .filter((field) => !areAuditValuesEqual(oldData[field], newData[field]))
    .map((field) => ({
      field,
      oldValue: oldData[field],
      newValue: newData[field],
    }));
}
