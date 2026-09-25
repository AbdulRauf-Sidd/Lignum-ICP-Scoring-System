"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { formatDate } from "@/lib/format";
import type { AppUser } from "@/lib/data/users";
import { createUser, setUserActive, updateUserModules } from "@/app/(dashboard)/admin/users/actions";
import { DEFAULT_USER_MODULES, MODULE_DESCRIPTIONS, MODULE_LABELS, APP_MODULES, type AppModule } from "@/lib/modules";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function usersSnapshot(users: AppUser[]): string {
  return JSON.stringify(users.map((user) => [user.id, user.modules, user.active]));
}

export function UsersWorkspace({ users, currentUserId }: { users: AppUser[]; currentUserId: string }) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [modules, setModules] = React.useState<AppModule[]>(DEFAULT_USER_MODULES);
  const [creating, setCreating] = React.useState(false);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [usersLoading, setUsersLoading] = React.useState(false);
  const pendingUsersSnapshot = React.useRef<string | null>(null);
  const currentUsersSnapshot = usersSnapshot(users);

  React.useEffect(() => {
    if (usersLoading && pendingUsersSnapshot.current !== currentUsersSnapshot) {
      pendingUsersSnapshot.current = null;
      setUsersLoading(false);
    }
  }, [currentUsersSnapshot, usersLoading]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await createUser({ email, password, fullName, modules });
      toast.success(`${email} added`);
      setEmail("");
      setPassword("");
      setFullName("");
      setModules(DEFAULT_USER_MODULES);
      router.refresh();
    } catch (err) {
      toast.error("Failed to create user", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setCreating(false);
    }
  }

  async function handleModulesChange(userId: string, nextModules: AppModule[]) {
    pendingUsersSnapshot.current = currentUsersSnapshot;
    setUsersLoading(true);
    setUpdatingId(userId);
    try {
      await updateUserModules(userId, nextModules);
      toast.success("Access updated");
      router.refresh();
    } catch (err) {
      pendingUsersSnapshot.current = null;
      setUsersLoading(false);
      toast.error("Failed to update access", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleActiveChange(userId: string, active: boolean) {
    pendingUsersSnapshot.current = currentUsersSnapshot;
    setUsersLoading(true);
    setUpdatingId(userId);
    try {
      await setUserActive(userId, active);
      toast.success(active ? "User activated" : "User made inactive");
      router.refresh();
    } catch (err) {
      pendingUsersSnapshot.current = null;
      setUsersLoading(false);
      toast.error("Failed to update account status", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setUpdatingId(null);
    }
  }

  function toggleModule(current: AppModule[], module: AppModule): AppModule[] {
    if (current.includes(module)) {
      return current.length > 1 ? current.filter((item) => item !== module) : current;
    }
    return [...current, module];
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
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
              <Label className="text-xs text-muted-foreground">Module access</Label>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {APP_MODULES.map((module) => (
                  <label key={module} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={modules.includes(module)}
                      disabled={modules.length === 1 && modules.includes(module)}
                      onCheckedChange={() => setModules((current) => toggleModule(current, module))}
                    />
                    {MODULE_LABELS[module]}
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={creating || modules.length === 0} className="w-fit sm:col-span-2 lg:col-span-4">
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
            {users.length} account{users.length === 1 ? "" : "s"} · Prospects are enabled by default for new users.
          </CardDescription>
        </CardHeader>
        <CardContent className="relative flex flex-col divide-y">
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
              <div className="flex max-w-md flex-wrap justify-end gap-1.5">
                {APP_MODULES.map((module) => {
                  const enabled = u.modules.includes(module);
                  return (
                    <button
                      key={module}
                      type="button"
                      title={MODULE_DESCRIPTIONS[module]}
                      disabled={updatingId === u.id || u.id === currentUserId}
                      onClick={() => handleModulesChange(u.id, toggleModule(u.modules, module))}
                      className={cn("rounded-md border px-2 py-1 text-xs", enabled ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground")}
                    >
                      {enabled && <Check className="mr-1 inline size-3" />}
                      {MODULE_LABELS[module]}
                    </button>
                  );
                })}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted-foreground">{u.active ? "Active" : "Inactive"}</span>
                <Switch checked={u.active} disabled={updatingId === u.id || u.id === currentUserId} onCheckedChange={(checked) => handleActiveChange(u.id, checked)} />
              </div>
            </div>
          ))}
          {usersLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 text-sm text-muted-foreground backdrop-blur-[1px]">
              <Loader2 className="mr-2 size-4 animate-spin" /> Updating users...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
