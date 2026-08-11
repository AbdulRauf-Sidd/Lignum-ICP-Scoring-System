import { createClient } from "@/lib/supabase/server";
import type { IcpProfile } from "@/lib/supabase/types";
import { IcpWeightsForm } from "./icp-weights-form";
import { AppConfigForm } from "./app-config-form";

export default async function ModelConfigPage() {
  const supabase = await createClient();

  const [{ data: profiles }, { data: settings }] = await Promise.all([
    supabase.from("icp_profiles").select("*").order("slug"),
    supabase.from("app_config").select("*").order("key"),
  ]);

  return (
    <div className="max-w-3xl">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        Admin
      </p>
      <h1 className="mt-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        Model config
      </h1>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        Weights, bands and thresholds. Changes apply on the next score or re-score, with no new
        API spend.
      </p>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          ICP weights <span className="font-normal text-neutral-400">(must sum to 100)</span>
        </h2>
        <div className="mt-3 space-y-3">
          {(profiles as IcpProfile[] | null)?.map((profile) => (
            <IcpWeightsForm key={profile.slug} profile={profile} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          Shared settings
        </h2>
        <p className="mt-1 text-xs text-neutral-400">
          Bands, tier thresholds, re-pull window, FX rate, sector taxonomy, contact-pull rule and
          metered-service prices. Edited as raw JSON for now; dedicated editors land alongside the
          scoring engine.
        </p>
        <div className="mt-3 space-y-3">
          {settings?.map((row) => (
            <AppConfigForm key={row.key} configKey={row.key} value={row.value} />
          ))}
        </div>
      </section>
    </div>
  );
}
