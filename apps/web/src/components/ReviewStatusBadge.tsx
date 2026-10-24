import type { ListReviewsStatus } from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Status = ListReviewsStatus;

// Queued and running use the stage pastels from docs/DESIGN.md, posted and failed the semantic colours.
const STATUS: Record<Status, { label: string; className?: string }> = {
  queued: { label: 'Queued', className: 'bg-stage-queued text-[#26251e]' },
  running: { label: 'Running', className: 'bg-stage-reviewing text-[#26251e]' },
  posted: { label: 'Posted', className: 'bg-success/15 text-success' },
  failed: { label: 'Failed', className: 'bg-destructive/10 text-destructive' },
  skipped: { label: 'Skipped' },
};

export function ReviewStatusBadge({ status, title }: { status: Status; title?: string }) {
  const { label, className } = STATUS[status];
  return (
    <Badge variant={status === 'skipped' ? 'secondary' : 'outline'} className={cn(className)} title={title}>
      {label}
    </Badge>
  );
}
