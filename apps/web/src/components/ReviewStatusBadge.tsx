import type { ListReviewsStatus } from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Status = ListReviewsStatus;

const STATUS: Record<Status, { label: string; className?: string }> = {
  queued: { label: 'Queued' },
  running: { label: 'Running', className: 'border-blue-500/30 bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  posted: { label: 'Posted', className: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  failed: { label: 'Failed', className: 'border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400' },
  skipped: { label: 'Skipped' },
};

export function ReviewStatusBadge({ status, title }: { status: Status; title?: string }) {
  const { label, className } = STATUS[status];
  return (
    <Badge variant={status === 'queued' || status === 'skipped' ? 'secondary' : 'outline'} className={cn(className)} title={title}>
      {label}
    </Badge>
  );
}
