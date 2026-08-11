export function PageStub({
  title,
  description,
  section,
}: {
  title: string;
  description: string;
  section: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        {section}
      </p>
      <h1 className="mt-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        {title}
      </h1>
      <p className="mt-2 max-w-xl text-sm text-neutral-500 dark:text-neutral-400">
        {description}
      </p>
      <div className="mt-6 rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-400 dark:border-neutral-700 dark:text-neutral-500">
        Built in a later phase.
      </div>
    </div>
  );
}
