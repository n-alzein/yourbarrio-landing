export const AI_DESCRIPTION_SURFACES = [
  "onboarding",
  "listing-editor",
  "business-profile",
];

export const AI_DESCRIPTION_ACTIONS = [
  "generate",
  "regenerate",
  "shorter",
  "more_premium",
  "more_casual",
  "add_details",
];

export const AI_DESCRIPTION_DAILY_LIMIT = 20;
export const AI_DESCRIPTION_TARGET_DAILY_LIMIT = 5;
export const AI_DESCRIPTION_DAILY_LIMIT_MESSAGE =
  "You’ve reached today’s AI description limit. You can try again tomorrow.";
export const AI_DESCRIPTION_BUSINESS_TIMEZONE = "America/Los_Angeles";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MODEL_PRICING_USD_PER_1M = [
  {
    prefix: "gpt-5.4-nano",
    input: 0.2,
    output: 1.25,
  },
  {
    prefix: "gpt-5.4-mini",
    input: 0.75,
    output: 4.5,
  },
  {
    prefix: "gpt-5.4",
    input: 2.5,
    output: 15,
  },
];

export function isValidAiDescriptionSurface(value) {
  return AI_DESCRIPTION_SURFACES.includes(String(value || "").trim());
}

export function isValidAiDescriptionAction(value) {
  return AI_DESCRIPTION_ACTIONS.includes(String(value || "").trim());
}

export function isUuid(value) {
  return UUID_RE.test(String(value || "").trim());
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function getTimeZoneDateParts(baseDate, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(baseDate);
  const valueByType = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  const hour = Number(valueByType.hour);
  return {
    year: Number(valueByType.year),
    month: Number(valueByType.month),
    day: Number(valueByType.day),
    // Some runtimes format local midnight as 24:00:00 for this timezone.
    hour: hour === 24 ? 0 : hour,
    minute: Number(valueByType.minute),
    second: Number(valueByType.second),
  };
}

function getTimeZoneOffsetMs(baseDate, timeZone) {
  const parts = getTimeZoneDateParts(baseDate, timeZone);
  const asUtcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return asUtcMs - baseDate.getTime();
}

function zonedDateTimeToUtcIso(
  { year, month, day, hour = 0, minute = 0, second = 0 },
  timeZone
) {
  const wallClockUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  let utcMs = wallClockUtcMs;

  for (let index = 0; index < 4; index += 1) {
    const offsetMs = getTimeZoneOffsetMs(new Date(utcMs), timeZone);
    const nextUtcMs = wallClockUtcMs - offsetMs;
    if (nextUtcMs === utcMs) break;
    utcMs = nextUtcMs;
  }

  return new Date(utcMs).toISOString();
}

export function getBusinessDayWindow(
  baseDate = new Date(),
  timeZone = AI_DESCRIPTION_BUSINESS_TIMEZONE
) {
  const parts = getTimeZoneDateParts(baseDate, timeZone);
  const startIso = zonedDateTimeToUtcIso(
    {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: 0,
      minute: 0,
      second: 0,
    },
    timeZone
  );

  const nextLocalDateUtc = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + 1, 0, 0, 0)
  );
  const endIso = zonedDateTimeToUtcIso(
    {
      year: nextLocalDateUtc.getUTCFullYear(),
      month: nextLocalDateUtc.getUTCMonth() + 1,
      day: nextLocalDateUtc.getUTCDate(),
      hour: 0,
      minute: 0,
      second: 0,
    },
    timeZone
  );

  return {
    timeZone,
    startIso,
    endIso,
    dayKey: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
  };
}

export function getBusinessDayStartIsoDaysAgo(
  daysAgo,
  baseDate = new Date(),
  timeZone = AI_DESCRIPTION_BUSINESS_TIMEZONE
) {
  const window = getBusinessDayWindow(baseDate, timeZone);
  if (!daysAgo) return window.startIso;

  const [year, month, day] = window.dayKey.split("-").map(Number);
  const targetLocalDateUtc = new Date(
    Date.UTC(year, month - 1, day - Number(daysAgo), 0, 0, 0)
  );
  return zonedDateTimeToUtcIso(
    {
      year: targetLocalDateUtc.getUTCFullYear(),
      month: targetLocalDateUtc.getUTCMonth() + 1,
      day: targetLocalDateUtc.getUTCDate(),
      hour: 0,
      minute: 0,
      second: 0,
    },
    timeZone
  );
}

export function getRollingWindowStartIso(days, baseDate = new Date()) {
  return new Date(baseDate.getTime() - days * MS_PER_DAY).toISOString();
}

export function estimateAiDescriptionCostCents({
  model,
  promptTokens,
  completionTokens,
}) {
  const normalizedModel = String(model || "").trim().toLowerCase();
  const pricing = MODEL_PRICING_USD_PER_1M.find((entry) =>
    normalizedModel.startsWith(entry.prefix)
  );
  if (!pricing) return null;

  const inputTokens = Number(promptTokens);
  const outputTokens = Number(completionTokens);
  if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) {
    return null;
  }

  const inputCostUsd = (inputTokens / 1_000_000) * pricing.input;
  const outputCostUsd = (outputTokens / 1_000_000) * pricing.output;
  const totalCostCents = (inputCostUsd + outputCostUsd) * 100;

  return Math.round(totalCostCents * 10_000) / 10_000;
}
