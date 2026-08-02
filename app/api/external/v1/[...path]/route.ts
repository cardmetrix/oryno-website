import { NextResponse, type NextRequest } from "next/server";
import { applyCorsHeaders } from "@/lib/external/cors";
import { resolveExternalToInternal } from "@/lib/external/paths";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  const remainder = `/${(path ?? []).join("/")}`;
  const resolved = resolveExternalToInternal(remainder);

  if (!resolved.ok) {
    const res = NextResponse.json(
      { error: resolved.error },
      { status: resolved.status },
    );
    applyCorsHeaders(res.headers, request);
    return res;
  }

  const target = new URL(
    `/api${resolved.internalPath}${request.nextUrl.search}`,
    request.url,
  );

  const headers = new Headers();
  const authorization = request.headers.get("authorization");
  if (authorization) headers.set("authorization", authorization);
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("accept", request.headers.get("accept") || "application/json");
  headers.set("x-oryno-external", "1");
  headers.set("x-oryno-external-path", remainder);

  const method = request.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);
  const body = hasBody ? await request.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      redirect: "manual",
      cache: "no-store",
    });
  } catch (error) {
    console.error("[external-api-proxy]", remainder, error);
    const res = NextResponse.json(
      { error: "Upstream API unavailable" },
      { status: 502 },
    );
    applyCorsHeaders(res.headers, request);
    return res;
  }

  const resHeaders = new Headers(upstream.headers);
  // Avoid leaking hop-by-hop headers
  resHeaders.delete("content-encoding");
  resHeaders.delete("transfer-encoding");
  resHeaders.delete("connection");
  applyCorsHeaders(resHeaders, request);
  resHeaders.set("X-Oryno-Internal-Path", resolved.internalPath);

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: resHeaders,
  });
}

export async function OPTIONS(request: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  applyCorsHeaders(res.headers, request);
  return res;
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
