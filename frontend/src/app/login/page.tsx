import { LoginPanel } from "@/components/LoginPanel";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <PageHeader
        title="Sign in"
        description="Pick a seeded demo role to explore the portal. These sessions match the acceptance checker."
      />
      <Card>
        <LoginPanel />
      </Card>
    </main>
  );
}
