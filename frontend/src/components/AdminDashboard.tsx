"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  fetchAdminStatsClient,
  fetchAdminUsersClient,
  suspendUserClient,
  type AdminStats,
  type AdminUser,
} from "@/lib/api";

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [statsData, usersData] = await Promise.all([
      fetchAdminStatsClient(),
      fetchAdminUsersClient(),
    ]);
    if (!statsData) {
      setError("Admin access required.");
    } else {
      setStats(statsData);
      setUsers(usersData);
      setError(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function suspend(userId: string) {
    setActionId(userId);
    const result = await suspendUserClient(userId);
    setActionId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    await load();
  }

  if (loading) {
    return <p className="text-zinc-500">Loading admin dashboard...</p>;
  }

  if (error && !stats) {
    return <Alert tone="error">{error}</Alert>;
  }

  return (
    <div className="space-y-8">
      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Users", value: stats.users },
            { label: "Events", value: stats.events },
            { label: "Projects", value: stats.projects },
            { label: "Participants", value: stats.participants },
            { label: "Judges", value: stats.judges },
            { label: "Organizers", value: stats.organizers },
          ].map((item) => (
            <Card key={item.label} variant="elevated">
              <p className="text-sm text-zinc-500">{item.label}</p>
              <p className="font-display mt-2 text-3xl font-bold text-zinc-900">
                {item.value}
              </p>
            </Card>
          ))}
        </div>
      ) : null}

      <Card variant="elevated" className="overflow-hidden p-0">
        <div className="border-b border-zinc-100 px-6 py-4">
          <h2 className="font-display text-lg font-bold text-zinc-900">Users</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-500">
              <tr>
                <th className="px-6 py-3 font-semibold">Name</th>
                <th className="px-6 py-3 font-semibold">Email</th>
                <th className="px-6 py-3 font-semibold">Role</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-zinc-100">
                  <td className="px-6 py-4 font-medium text-zinc-900">
                    {user.name || "—"}
                  </td>
                  <td className="px-6 py-4 text-zinc-600">{user.email}</td>
                  <td className="px-6 py-4">
                    <Badge tone="default">{user.role}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    {user.suspended ? (
                      <Badge tone="warning">Suspended</Badge>
                    ) : (
                      <Badge tone="success">Active</Badge>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {!user.suspended ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={actionId === user.id}
                        onClick={() => suspend(user.id)}
                      >
                        {actionId === user.id ? "..." : "Suspend"}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
