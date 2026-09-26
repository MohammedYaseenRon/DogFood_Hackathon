import { backendUrl } from "@/lib/api";

export async function GET(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const res = await fetch(`${backendUrl}/api/auth/me`, {
    headers: { cookie },
  });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
