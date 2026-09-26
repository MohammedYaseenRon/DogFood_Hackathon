import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/judge/scores",
        destination: `${backendUrl}/api/judge/scores`,
      },
      {
        source: "/api/judge/assignments",
        destination: `${backendUrl}/api/judge/assignments`,
      },
      {
        source: "/api/judge/rubric",
        destination: `${backendUrl}/api/judge/rubric`,
      },
      {
        source: "/api/organizer/rubric",
        destination: `${backendUrl}/api/organizer/rubric`,
      },
      {
        source: "/api/organizer/stats",
        destination: `${backendUrl}/api/organizer/stats`,
      },
      {
        source: "/api/export.csv",
        destination: `${backendUrl}/api/export.csv`,
      },
      {
        source: "/api/teams/join/:token",
        destination: `${backendUrl}/api/teams/join/:token`,
      },
    ];
  },
};

export default nextConfig;
