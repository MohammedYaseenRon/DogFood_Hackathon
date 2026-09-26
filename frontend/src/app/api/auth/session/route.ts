import { backendUrl } from "@/lib/api";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key) {
    return Response.json({ detail: "Missing session key" }, { status: 400 });
  }

  const res = await fetch(
    `${backendUrl}/api/auth/session?key=${encodeURIComponent(key)}`,
    { method: "POST" },
  );
  const data = await res.json();

  if (!res.ok) {
    return Response.json(data, { status: res.status });
  }

  const response = Response.json(data);
  response.headers.append(
    "Set-Cookie",
    `session=${key}; Path=/; HttpOnly; SameSite=Lax`,
  );
  return response;
}
