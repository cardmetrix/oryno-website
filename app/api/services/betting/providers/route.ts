export const runtime = "nodejs";

export async function GET() {
  const mod = await import("@/app/api/betting/providers/route");
  return mod.GET();
}
