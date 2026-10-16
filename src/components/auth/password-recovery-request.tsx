"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { KeyRound, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { toast } from "sonner";

export function PasswordRecoveryRequest() {
  const searchParams = useSearchParams();
  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm`,
    });
    setSubmitting(false);

    if (error) {
      toast.error("Couldn't send the recovery email", { description: error.message });
      return;
    }
    toast.success("If an account exists for that email, a recovery link is on its way.");
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
      <section className="w-full max-w-sm">
        <div className="mb-6 flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <KeyRound className="size-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enter your account email and Supabase will send a recovery link.</p>

        {searchParams.get("error") === "invalid_link" && (
          <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            This recovery link is invalid or has expired. Request a new one to continue.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="recovery-email">Email</Label>
            <div className="relative">
              <Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="recovery-email"
                type="email"
                autoComplete="email"
                required
                className="pl-9"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" />}
            Send recovery email
          </Button>
        </form>
      </section>
    </main>
  );
}
