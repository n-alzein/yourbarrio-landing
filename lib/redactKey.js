export function redactKey(value) {
  if (!value) return null;
  const raw = String(value);
  return `***${raw.slice(-6)}`;
}
