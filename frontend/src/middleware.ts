import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:4000";

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/projects/new" && request.method === "POST") {
    const body = await request.text();
    const response = await fetch(`${backendUrl}/projects/new`, {
      method: "POST",
      headers: {
        "Content-Type":
          request.headers.get("content-type") ?? "application/json",
        cookie: request.headers.get("cookie") ?? "",
      },
      body,
    });

    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ?? "application/json",
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/projects/new"],
};
