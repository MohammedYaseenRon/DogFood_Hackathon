"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  fetchAdminStatsClient,
  fetchAdminUsersClient,
  fetchAuditLogClient,
  fetchMeClient,
  setUserRoleClient,
  setUserSuspendedClient,
  type AdminStats,
  type AdminUser,
  type AuditEntry,
  type UserRole,
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { loginHref } from "@/lib/role-auth";

const ROLES: UserRole[] = ["VISITOR", "PARTICIPANT", "JUDGE", "ORGANIZER", "ADMIN"];

export function AdminDashboard() {
  const [meId, setMeId] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [tab, setTab] = useState<"users" | "audit">("users");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadUsers = useCallback(async (q: string, role: string) => {
    const data = await fetchAdminUsersClient({ q: q || undefined, role: role || undefined });
    setUsers(data.users);
    setTotal(data.total);
  }, []);

  useEffect(() => {
    (async () => {
      const me = await fetchMeClient();
      setMeId(me?.id ?? null);
      if (me?.role !== "ADMIN") {
        setAllowed(false);
        return;
      }
      setAllowed(true);
      const [statsData, logData] = await Promise.all([fetchAdminStatsClient(), fetchAuditLogClient()]);
      setStats(statsData);
      setLogs(logData);
      await loadUsers("", "");
    })();
  }, [loadUsers]);

  async function refresh() {
    const [statsData, logData] = await Promise.all([fetchAdminStatsClient(), fetchAuditLogClient()]);
    setStats(statsData);
    setLogs(logData);
    await loadUsers(query, roleFilter);
  }

  async function changeRole(user: AdminUser, role: UserRole) {
    if (role === user.role) return;
    if (!window.confirm(`Change ${user.email} from ${user.role} to ${role}?`)) return;
    setError(null);
    setNotice(null);
    setActionId(user.id);
    const result = await setUserRoleClient(user.id, role);
    setActionId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setNotice(`${user.email} is now ${role}.`);
    await refresh();
  }

  async function toggleSuspended(user: AdminUser) {
    const next = !user.suspended;
    if (next && !window.confirm(`Suspend ${user.email}? They'll be signed out everywhere.`)) return;
    setError(null);
    setNotice(null);
    setActionId(user.id);
    const result = await setUserSuspendedClient(user.id, next);
    setActionId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setNotice(`${user.email} ${next ? "suspended" : "reactivated"}.`);
    await refresh();
  }

  if (allowed === null) {
    return <p className="text-zinc-500">Loading admin dashboard…</p>;
  }

  if (!allowed) {
    return (
      <Card variant="elevated" className="mx-auto max-w-lg text-center">
        <p className="font-display text-lg font-bold text-zinc-900">Admin access required</p>
        <p className="mt-2 text-sm text-zinc-500">Sign in with an admin account to manage users.</p>
        <ButtonLink href={loginHref("/admin", "admin")} className="mt-5">
          Sign in as admin
        </ButtonLink>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {stats ? (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Users", value: stats.users },
            { label: "Participants", value: stats.participants },
            { label: "Judges", value: stats.judges },
            { label: "Organizers", value: stats.organizers },
            { label: "Events", value: stats.events },
            { label: "Submitted", value: stats.submitted, hint: `${stats.drafts} drafts` },
          ].map((item) => (
            <Card key={item.label} variant="elevated" className="p-5">
              <p className="text-sm text-zinc-500">{item.label}</p>
              <p className="font-display mt-1 text-3xl font-bold text-zinc-900">{item.value}</p>
              {item.hint ? <p className="text-xs text-zinc-400">{item.hint}</p> : null}
            </Card>
          ))}
        </div>
      ) : null}

      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="flex gap-2 border-b border-zinc-200">
        {(["users", "audit"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              tab === key ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {key === "users" ? "Users" : "Audit log"}
          </button>
        ))}
      </div>

      {tab === "users" ? (
        <Card variant="elevated" className="overflow-hidden p-0">
          <form
            className="flex flex-wrap items-center gap-3 border-b border-zinc-100 px-6 py-4"
            onSubmit={(e) => {
              e.preventDefault();
              void loadUsers(query, roleFilter);
            }}
          >
            <input
              type="search"
              aria-label="Search users"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or email"
              className="min-w-[14rem] flex-1 rounded-xl border border-zinc-200 px-4 py-2 text-sm focus:border-zinc-400 focus:outline-none"
            />
            <select
              aria-label="Filter by role"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                void loadUsers(query, e.target.value);
              }}
              className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            >
              <option value="">All roles</option>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm">
              Search
            </Button>
            <span className="text-sm text-zinc-500">
              {users.length} of {total}
            </span>
          </form>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-500">
                <tr>
                  <th className="px-6 py-3 font-semibold">User</th>
                  <th className="px-6 py-3 font-semibold">Role</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Joined</th>
                  <th className="px-6 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const self = user.id === meId;
                  return (
                    <tr key={user.id} className="border-t border-zinc-100">
                      <td className="px-6 py-3">
                        <p className="font-medium text-zinc-900">
                          {user.name || "—"}
                          {self ? <span className="ml-1.5 text-xs text-zinc-400">(you)</span> : null}
                        </p>
                        <p className="text-xs text-zinc-500">{user.email}</p>
                      </td>
                      <td className="px-6 py-3">
                        <select
                          aria-label={`Role for ${user.email}`}
                          value={user.role}
                          disabled={self || actionId === user.id}
                          onChange={(e) => void changeRole(user, e.target.value as UserRole)}
                          className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-semibold"
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-3">
                        {user.suspended ? <Badge tone="danger">Suspended</Badge> : <Badge tone="success">Active</Badge>}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-zinc-500">{formatDateTime(user.createdAt)}</td>
                      <td className="px-6 py-3">
                        {!self ? (
                          <Button
                            variant={user.suspended ? "secondary" : "ghost"}
                            size="sm"
                            disabled={actionId === user.id}
                            onClick={() => void toggleSuspended(user)}
                            className={user.suspended ? "" : "text-red-600 hover:bg-red-50"}
                          >
                            {actionId === user.id ? "…" : user.suspended ? "Reactivate" : "Suspend"}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card variant="elevated" className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-500">
                <tr>
                  <th className="px-6 py-3 font-semibold">When</th>
                  <th className="px-6 py-3 font-semibold">Actor</th>
                  <th className="px-6 py-3 font-semibold">Action</th>
                  <th className="px-6 py-3 font-semibold">Resource</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-zinc-100 align-top">
                    <td className="px-6 py-3 whitespace-nowrap text-zinc-500">{formatDateTime(log.createdAt)}</td>
                    <td className="px-6 py-3 text-zinc-700">{log.actorEmail ?? "system"}</td>
                    <td className="px-6 py-3">
                      <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">{log.action}</code>
                    </td>
                    <td className="px-6 py-3 text-xs text-zinc-500">
                      {log.resourceType}
                      {log.resourceId ? ` · ${log.resourceId}` : ""}
                      {log.metadata && log.metadata !== "{}" ? (
                        <span className="mt-1 block font-mono text-[11px] text-zinc-400">{log.metadata}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
