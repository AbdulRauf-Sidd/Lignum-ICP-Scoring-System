"use client";

import * as React from "react";
import Link from "next/link";
import { KeyRound, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { toast } from "sonner";

type LinkState = "checking" | "ready" | "invalid";

// Supabase recovery emails (sent from the dashboard with the default template)
// verify the token on Supabase's side, then redirect here with the session in
// the URL hash: #access_token=...&refresh_token=...&type=recovery, or
// #error=...&error_description=... when the link is expired or already used.
// The browser client runs in PKCE mode and won't read that format, so it's
// handled here.
async function sessionFromRecoveryHash(): Promise<LinkState> {
  const params = new URLSearchParams(window.location.hash.slice(1));
  // Drop the tokens from the address bar and history either way.
  if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken || params.get("type") !== "recovery") return "invalid";

  const { error } = await getSupabaseBrowserClient().auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return error ? "invalid" : "ready";
}

export function ResetPasswordForm() {
  const [linkState, setLinkState] = React.useState<LinkState>("checking");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    sessionFromRecoveryHash().then(setLinkState);
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    if (password.length < 8) {
      toast.error("Use a password with at least 8 characters");
      return;
    }

    setSubmitting(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSubmitting(false);
      toast.error("Couldn't update your password", { description: error.message });
      return;
    }
    // End the recovery session so they sign in fresh with the new password.
    await supabase.auth.signOut();
    window.location.replace("/login?reset=success");
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
      <section className="w-full max-w-sm">
        <div className="mb-6 flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <KeyRound className="size-5" />
        </div>

        {linkState === "checking" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Checking your reset link...
          </p>
        )}

        {linkState === "invalid" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Link invalid or expired</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Password reset links work once and expire after a while. Ask an admin to send you a new one.
            </p>
            <Button asChild variant="outline" className="mt-6 w-full">
              <Link href="/login">Back to sign in</Link>
            </Button>
          </>
        )}

        {linkState === "ready" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
            <p className="mt-1 text-sm text-muted-foreground">Use at least 8 characters.</p>
            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New password</Label>
                <div className="relative">
                  <Lock className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="new-password" type="password" autoComplete="new-password" minLength={8} required className="pl-9" value={password} onChange={(event) => setPassword(event.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <div className="relative">
                  <Lock className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required className="pl-9" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                </div>
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="animate-spin" />}
                Update password
              </Button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
