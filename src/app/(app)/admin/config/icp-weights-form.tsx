"use client";

import { useActionState } from "react";
import { updateIcpWeights } from "./actions";
import type { IcpProfile } from "@/lib/supabase/types";

const FIELDS: { key: keyof IcpProfile["weights"]; label: string }[] = [
  { key: "icp_fit", label: "ICP fit" },
  { key: "scale_footprint", label: "Scale & footprint" },
  { key: "hiring_growth", label: "Hiring & growth" },
  { key: "financial_viability", label: "Financial viability" },
];

export function IcpWeightsForm({ profile }: { profile: IcpProfile }) {
  const [state, action, pending] = useActionState(updateIcpWeights, undefined);

  return (
    <form
      action={action}
      className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
    >
      <input type="hidden" name="slug" value={profile.slug} />
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {profile.name}
        </h3>
        <span className="text-xs text-neutral-400">{profile.slug}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FIELDS.map(({ key, label }) => (
          <label key={key} className="text-xs text-neutral-500 dark:text-neutral-400">
            {label}
            <input
              type="number"
              name={key}
              min={0}
              max={100}
              defaultValue={profile.weights[key]}
              className="mt-1 w-full rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-sm text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
            />
          </label>
        ))}
      </div>
      {state?.error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {pending ? "Saving…" : "Save weights"}
      </button>
    </form>
  );
}
