import { AdminDashboard } from "@/components/AdminDashboard";
import { PageShell } from "@/components/ui/PageShell";

export default function AdminPage() {
  return (
    <PageShell
      eyebrow="Administration"
      title="Platform admin"
      description="Manage users, review platform statistics, and moderate accounts."
    >
      <AdminDashboard />
    </PageShell>
  );
}
