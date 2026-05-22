const SENSITIVE_TEMPLATE_HEADERS: ReadonlySet<string> = new Set([
  "authorization",
  "x-csrf-token",
  "x-client-transaction-id",
  "x-client-uuid"
]);

export function isSensitiveTemplateHeaderName(name: string): boolean {
  return SENSITIVE_TEMPLATE_HEADERS.has(name.toLowerCase());
}

export function stripSensitiveTemplateHeaders(
  headers: Record<string, string>
): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [rawName, value] of Object.entries(headers)) {
    if (typeof value !== "string") {
      continue;
    }

    const name = rawName.toLowerCase();

    if (SENSITIVE_TEMPLATE_HEADERS.has(name)) {
      continue;
    }

    sanitized[name] = value;
  }

  return sanitized;
}
