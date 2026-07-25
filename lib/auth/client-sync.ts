export async function syncSessionToDatabase(): Promise<{
  ok: boolean;
  error?: string;
  code?: string;
}> {
  const res = await fetch("/api/auth/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
    };
    return {
      ok: false,
      error: body.error ?? "Failed to sync account",
      code: body.code,
    };
  }

  return { ok: true };
}
