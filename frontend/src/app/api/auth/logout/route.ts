import { backendUrl } from "@/lib/api";

export async function POST(request: Request) {
  // Forward the cookie so the backend can invalidate the server-side session.
  await fetch(`${backendUrl}/api/auth/logout`, {
    method: "POST",
    headers: { cookie: request.headers.get("cookie") ?? "" },
  }).catch(() => null);

  const response = Response.json({ ok: true });
  response.headers.append(
    "Set-Cookie",
    "session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
  );
  return response;
}
