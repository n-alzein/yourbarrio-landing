export function redactMediaErrorMessage(message) {
  return String(message || "")
    .replace(/(?:business-photos|listing-photos|business-gallery|avatars)\/[^\s'",)]+/gi, "[storage-path]")
    .replace(/tmp\/[^\s'",)]+/gi, "[storage-path]");
}
