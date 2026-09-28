import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    // Returned as an array these are "afterFiles" rewrites: Next's own route
    // handlers (src/app/api/auth/*) win, everything else under /api goes to
    // the FastAPI backend with cookies intact.
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
