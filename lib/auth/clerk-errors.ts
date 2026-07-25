export function clerkErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object") return fallback;

  const anyErr = err as {
    errors?: Array<{ longMessage?: string; message?: string; code?: string }>;
    message?: string;
  };

  const first = anyErr.errors?.[0];
  if (first?.longMessage) return first.longMessage;
  if (first?.message) return first.message;
  if (typeof anyErr.message === "string" && anyErr.message) return anyErr.message;
  return fallback;
}
