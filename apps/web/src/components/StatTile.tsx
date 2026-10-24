import { cn } from '@/lib/utils';

// One number in a card: a label on top, the value in a darker box below, and a line of detail under the value.
// The same tile is used for the live status and for the usage totals, so the dashboard reads as one grid.
export function StatTile({
  label,
  value,
  detail,
  title,
  className,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  // Shown when the pointer rests on the value, for the exact number behind a shortened one.
  title?: string;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl border bg-card p-1', className)}>
      <p className="px-3 pt-2 pb-2 text-sm">{label}</p>
      <div className="rounded-lg bg-background px-3 py-3" title={title}>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {detail !== undefined && <div className="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">{detail}</div>}
      </div>
    </div>
  );
}
