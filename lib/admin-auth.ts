import { env } from "cloudflare:workers";

export function isAdmin(request: Request) {
  const expected = env.ADMIN_PASSWORD || "";
  const received = request.headers.get("x-kk-admin-password") || "";
  if (expected.length < 8 || received.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  return difference === 0;
}

export function privateJson(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}
