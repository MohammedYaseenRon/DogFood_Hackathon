import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:4000";

/**
 * `/projects/new` is both a page (GET) and the submission endpoint the
 * acceptance checker POSTs to. Forward POSTs to the backend; let GETs render.
 */
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/projects/new" && request.method === "POST") {
    const response = await fetch(`${backendUrl}/projects/new`, {
      method: "POST",
      headers: {
        "Content-Type": request.headers.get("content-type") ?? "application/json",
        cookie: request.headers.get("cookie") ?? "",
      },
      body: await request.text(),
    });

    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "application/json",
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/projects/new"],
};
