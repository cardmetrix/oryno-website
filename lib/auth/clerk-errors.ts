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

export function pickLoginSecondFactor(
  factors: Array<{ strategy: string }> | null | undefined,
): "totp" | "email_code" | null {
  if (!factors?.length) return null;
  if (factors.some((f) => f.strategy === "totp")) return "totp";
  if (factors.some((f) => f.strategy === "email_code")) return "email_code";
  return null;
}
