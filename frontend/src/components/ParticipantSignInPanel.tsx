"use client";

import { RoleSignInPanel } from "@/components/RoleSignInPanel";

export function ParticipantSignInPanel({
  embedded = false,
  redirectTo = "/participant",
}: {
  embedded?: boolean;
  redirectTo?: string;
}) {
  return (
    <RoleSignInPanel
      roleMode="participant"
      redirectTo={redirectTo}
      embedded={embedded}
    />
  );
}
