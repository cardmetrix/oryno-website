import { flutterwaveHttp } from "@/lib/flutterwave/http";

/** Best-effort outbound IP Flutterwave will see (uses proxy when configured). */
export async function getServerEgressIp() {
  try {
    const res = await flutterwaveHttp("https://api.ipify.org?format=json");
    if (!res.ok) return null;
    const json = (await res.json()) as { ip?: string };
    return json.ip?.trim() || null;
  } catch {
    return null;
  }
}
