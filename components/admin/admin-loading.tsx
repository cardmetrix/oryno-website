export function AdminLoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[180px] items-center justify-center rounded-[18px] border border-dashed border-border bg-muted/30 px-4 py-10 text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function AdminErrorBlock({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-[18px] border border-border bg-muted/30 px-4 py-6 text-center">
      <p className="text-sm font-medium text-[var(--oryno-error)]">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="btn-secondary mt-3 h-10 px-4 text-sm"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function AdminEmptyBlock({ message }: { message: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
