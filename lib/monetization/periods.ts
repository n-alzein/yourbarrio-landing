export type UsagePeriod = {
  periodStart: string;
  periodEnd: string;
};

function toUtcDate(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function getMonthlyUsagePeriod(date = new Date()): UsagePeriod {
  const normalized = toUtcDate(date);
  const start = new Date(Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth(), 1));
  const end = new Date(Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth() + 1, 1));
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
}

