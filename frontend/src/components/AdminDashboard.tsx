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
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-ink" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <Card variant="elevated" className="mx-auto max-w-lg text-center">
        <p className="font-display text-lg font-semibold text-ink">Admin access required</p>
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
        <div className="relative overflow-hidden rounded-2xl bg-ink text-white">
          <div aria-hidden className="graph-paper-dark absolute inset-0" />
          <dl className="relative grid grid-cols-2 divide-white/10 sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
          {[
            { label: "Users", value: stats.users },
            { label: "Participants", value: stats.participants },
            { label: "Judges", value: stats.judges },
            { label: "Organizers", value: stats.organizers },
            { label: "Events", value: stats.events },
            { label: "Submitted", value: stats.submitted, hint: `${stats.drafts} drafts` },
          ].map((item) => (
            <div key={item.label} className="border-b border-white/10 px-6 py-5 lg:border-b-0">
              <dt className="font-mono text-[11px] tracking-[0.14em] text-white/50 uppercase">{item.label}</dt>
              <dd className="font-display mt-2 text-3xl font-semibold tabular-nums">{item.value}</dd>
              {item.hint ? <dd className="mt-1 text-xs text-signal-300">{item.hint}</dd> : null}
            </div>
          ))}
          </dl>
        </div>
      ) : null}

      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div role="tablist" className="inline-flex rounded-lg border border-line bg-white p-1">
        {(["users", "audit"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            role="tab"
            aria-selected={tab === key}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
              tab === key ? "bg-ink text-white" : "text-zinc-500 hover:text-ink"
            }`}
          >
            {key === "users" ? "Users" : "Audit log"}
          </button>
        ))}
      </div>

      {tab === "users" ? (
        <Card variant="elevated" className="overflow-hidden p-0">
          <form
            className="flex flex-wrap items-center gap-3 border-b border-line bg-zinc-50/60 px-6 py-4"
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
              className="field min-w-[14rem] flex-1 py-2"
            />
            <select
              aria-label="Filter by role"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                void loadUsers(query, e.target.value);
              }}
              className="field w-auto py-2"
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
            <span className="font-mono text-xs text-zinc-500">
              {users.length} / {total}
            </span>
          </form>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left font-mono text-[11px] tracking-[0.12em] text-zinc-500 uppercase">
                <tr>
                  <th className="px-6 py-3 font-medium">User</th>
                  <th className="px-6 py-3 font-medium">Role</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Joined</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const self = user.id === meId;
                  return (
                    <tr key={user.id} className="border-t border-line transition hover:bg-zinc-50/70">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-sm font-semibold text-zinc-600">
                            {(user.name || user.email).charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-ink">
                              {user.name || "—"}
                              {self ? <span className="ml-2 align-middle"><Badge tone="cyan">you</Badge></span> : null}
                            </p>
                            <p className="text-xs text-zinc-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <select
                          aria-label={`Role for ${user.email}`}
                          value={user.role}
                          disabled={self || actionId === user.id}
                          onChange={(e) => void changeRole(user, e.target.value as UserRole)}
                          className="field w-auto px-2.5 py-1.5 font-mono text-xs"
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
              <thead className="border-b border-line text-left font-mono text-[11px] tracking-[0.12em] text-zinc-500 uppercase">
                <tr>
                  <th className="px-6 py-3 font-medium">When</th>
                  <th className="px-6 py-3 font-medium">Actor</th>
                  <th className="px-6 py-3 font-medium">Action</th>
                  <th className="px-6 py-3 font-medium">Resource</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-line align-top transition hover:bg-zinc-50/70">
                    <td className="px-6 py-3 whitespace-nowrap text-zinc-500">{formatDateTime(log.createdAt)}</td>
                    <td className="px-6 py-3 font-medium text-ink">{log.actorEmail ?? "system"}</td>
                    <td className="px-6 py-3">
                      <code className="rounded-md bg-brand-50 px-1.5 py-0.5 font-mono text-xs text-brand-700">{log.action}</code>
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
