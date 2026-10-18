export function getErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "string" && err.trim()) return err;
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === "object") {
    const record = err as { message?: unknown; detail?: unknown; response?: { data?: { detail?: unknown } } };
    const detail = record.detail ?? record.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => (item && typeof (item as { msg?: unknown }).msg === "string" ? (item as { msg: string }).msg : ""))
        .filter(Boolean);
      if (messages.length) return messages.join(" ");
    }
    if (typeof record.message === "string" && record.message.trim()) return record.message;
  }
  return fallback;
}

export function safeReturnTo(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const candidate = value.trim();
  if (!candidate.startsWith("/")) return undefined;
  if (candidate.startsWith("//")) return undefined;
  if (/[\u0000-\u001f\u007f\\]/.test(candidate)) return undefined;
  try {
    const base = "http://localhost";
    const url = new URL(candidate, base);
    if (url.origin !== base) return undefined;
    if (/^\/(login|register)(\/|$)/.test(url.pathname)) return undefined;
    return url.pathname + url.search + url.hash;
  } catch {
    return undefined;
  }
}
