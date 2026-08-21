"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Layers, Loader2, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { toast } from "sonner";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast.error("Couldn't sign in", { description: error.message });
      setSubmitting(false);
      return;
    }

    const next = searchParams.get("next") || "/";
    router.push(next);
    router.refresh();
  }

  return (
    <div className="flex min-h-svh w-full">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-sidebar px-12 py-12 text-sidebar-foreground lg:flex">
        <div className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-sidebar-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-sidebar-ring/10 blur-3xl" />

        <div aria-hidden className="relative" />

        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight text-balance">
            Score, enrich and prioritise your pipeline.
          </h1>
          <p className="mt-3 text-sm text-sidebar-foreground/70">
            Import target companies, run enrichment and let ICP scoring surface the accounts worth chasing first.
          </p>
        </div>

        <p className="relative text-xs text-sidebar-foreground/40">© {new Date().getFullYear()} Lignum</p>
      </div>

      <div className="flex w-full flex-1 items-center justify-center bg-background px-4 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-2 text-center lg:hidden">
            <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Layers className="size-5" />
            </div>
            <p className="text-lg font-semibold">Lignum ICP Scoring</p>
          </div>

          <div className="mb-8 hidden lg:block">
            <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to your account to continue.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" disabled={submitting} className="mt-2">
              {submitting && <Loader2 className="animate-spin" />}
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
