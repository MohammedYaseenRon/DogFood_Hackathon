import { backendUrl } from "@/lib/api";

export async function POST(request: Request) {
  const body = await request.json();
  const res = await fetch(`${backendUrl}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Rate limits and abuse checks key on the real client, not this server.
      "x-forwarded-for": request.headers.get("x-forwarded-for") ?? "",
      "user-agent": request.headers.get("user-agent") ?? "",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  const response = Response.json(data, { status: res.status });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    response.headers.append("Set-Cookie", setCookie);
  }
  return response;
}
