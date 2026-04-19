const LOCAL_DATE_TIME_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
  timeStyle: "short",
};

const LOCAL_DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
};

const LOCAL_TIME_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  timeStyle: "short",
};

export function parseIsoDateTime(value: string | null | undefined): Date | null {
  if (!value || typeof value !== "string") return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

export function formatLocalDateTime(value: string | null | undefined): string {
  const parsed = parseIsoDateTime(value);
  if (!parsed) return "—";

  return parsed.toLocaleString("en-US", LOCAL_DATE_TIME_FORMAT_OPTIONS);
}

export function formatLocalTime(value: string | null | undefined): string {
  const parsed = parseIsoDateTime(value);
  if (!parsed) return "—";

  return parsed.toLocaleTimeString("en-US", LOCAL_TIME_FORMAT_OPTIONS);
}

export function getLocalDateKey(value: string | null | undefined): string {
  const parsed = parseIsoDateTime(value);
  if (!parsed) return "unknown";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatLocalDateLabel(value: string | null | undefined): string {
  const parsed = parseIsoDateTime(value);
  if (!parsed) return "Unknown date";

  return parsed.toLocaleDateString("en-US", LOCAL_DATE_FORMAT_OPTIONS);
}

export function formatLocalDateGroupLabel(
  value: string | null | undefined,
  now: Date = new Date()
): string {
  const parsed = parseIsoDateTime(value);
  if (!parsed) return "Unknown date";

  const todayKey = getLocalDateKey(now.toISOString());
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getLocalDateKey(yesterday.toISOString());
  const valueKey = getLocalDateKey(value);

  if (valueKey === todayKey) return "Today";
  if (valueKey === yesterdayKey) return "Yesterday";

  return formatLocalDateLabel(value);
}
