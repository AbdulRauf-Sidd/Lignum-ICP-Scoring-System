"use client";

import { useActionState } from "react";
import { updateAppConfig } from "./actions";

export function AppConfigForm({ configKey, value }: { configKey: string; value: unknown }) {
  const [state, action, pending] = useActionState(updateAppConfig, undefined);

  return (
    <form
      action={action}
      className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
    >
      <input type="hidden" name="key" value={configKey} />
      <h3 className="font-mono text-sm font-medium text-neutral-900 dark:text-neutral-100">
        {configKey}
      </h3>
      <textarea
        name="value"
        rows={4}
        defaultValue={JSON.stringify(value, null, 2)}
        spellCheck={false}
        className="mt-2 w-full rounded-md border border-neutral-300 bg-transparent p-2 font-mono text-xs text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
      />
      {state?.error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
