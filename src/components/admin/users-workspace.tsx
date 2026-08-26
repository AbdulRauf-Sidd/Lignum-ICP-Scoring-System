"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import type { AppUser } from "@/lib/data/users";
import type { UserRole } from "@/lib/supabase/auth-server";
import { createUser, updateUserRole } from "@/app/(dashboard)/admin/users/actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const ROLE_LABELS: Record<UserRole, string> = { admin: "Admin", user: "User" };

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function UsersWorkspace({ users, currentUserId }: { users: AppUser[]; currentUserId: string }) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [role, setRole] = React.useState<UserRole>("user");
  const [creating, setCreating] = React.useState(false);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await createUser({ email, password, fullName, role });
      toast.success(`${email} added as ${ROLE_LABELS[role]}`);
      setEmail("");
      setPassword("");
      setFullName("");
      setRole("user");
      router.refresh();
    } catch (err) {
      toast.error("Failed to create user", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setCreating(false);
    }
  }

  async function handleRoleChange(userId: string, nextRole: UserRole) {
    setUpdatingId(userId);
    try {
      await updateUserRole(userId, nextRole);
      toast.success("Role updated");
      router.refresh();
    } catch (err) {
      toast.error("Failed to update role", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <UserPlus className="size-4" /> Add a user
          </CardTitle>
          <CardDescription>Creates the account immediately — they can sign in with this password right away.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Full name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jordan Lee" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jordan@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Password</Label>
              <Input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={creating} className="w-fit sm:col-span-2 lg:col-span-4">
              {creating && <Loader2 className="size-4 animate-spin" />}
              Add user
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            {users.length} account{users.length === 1 ? "" : "s"} · Admins can reach every page; Users can&apos;t open Accounts or
            Model config.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold text-muted-foreground">
                {initials(u.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium">{u.name}</p>
                  {u.id === currentUserId && (
                    <Badge variant="outline" className="border-transparent bg-muted text-[10px] text-muted-foreground uppercase">
                      You
                    </Badge>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                Joined {formatDate(u.createdAt)}
                {u.lastSignInAt ? ` · last in ${formatDate(u.lastSignInAt)}` : " · never signed in"}
              </span>
              <Select
                value={u.role}
                onValueChange={(v) => handleRoleChange(u.id, v as UserRole)}
                disabled={updatingId === u.id || u.id === currentUserId}
              >
                <SelectTrigger className={cn("w-28 shrink-0", u.role === "admin" && "text-primary")}>
                  {updatingId === u.id ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
