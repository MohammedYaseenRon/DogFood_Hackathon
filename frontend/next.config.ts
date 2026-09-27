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
      {
        source: "/api/teams/mine",
        destination: `${backendUrl}/api/teams/mine`,
      },
      {
        source: "/api/teams",
        destination: `${backendUrl}/api/teams`,
      },
      {
        source: "/api/projects/mine",
        destination: `${backendUrl}/api/projects/mine`,
      },
      {
        source: "/api/projects/:id",
        destination: `${backendUrl}/api/projects/:id`,
      },
      {
        source: "/api/events",
        destination: `${backendUrl}/api/events`,
      },
    ];
  },
};

export default nextConfig;
