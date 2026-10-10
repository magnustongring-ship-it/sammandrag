export function FormMessage({
  state,
}: {
  state: { error?: string; message?: string } | undefined;
}) {
  if (state?.error) {
    return (
      <p
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {state.error}
      </p>
    );
  }
  if (state?.message) {
    return (
      <p
        role="status"
        className="rounded-md border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300"
      >
        {state.message}
      </p>
    );
  }
  return null;
}
