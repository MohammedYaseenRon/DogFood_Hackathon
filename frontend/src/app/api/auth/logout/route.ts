import { backendUrl } from "@/lib/api";

export async function POST() {
  await fetch(`${backendUrl}/api/auth/logout`, { method: "POST" });

  const response = Response.json({ ok: true });
  response.headers.append(
    "Set-Cookie",
    "session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
  );
  return response;
}
