/** Best-effort outbound IP for the current server (for Flutterwave whitelist). */
export async function getServerEgressIp() {
  try {
    const res = await fetch("https://api.ipify.org?format=json", {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { ip?: string };
    return json.ip?.trim() || null;
  } catch {
    return null;
  }
}
