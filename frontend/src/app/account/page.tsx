import { AccountSettings } from "@/components/AccountSettings";
import { PageShell } from "@/components/ui/PageShell";

export default function AccountPage() {
  return (
    <PageShell
      tone="slate"
      eyebrow="Account"
      title="Account settings"
      description="Update your name and password."
      maxWidth="max-w-5xl"
    >
      <AccountSettings />
    </PageShell>
  );
}
