import { Loader2 } from 'lucide-react';
import type { ListReviewsStatus } from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Status = ListReviewsStatus;

// Running, posted and failed are tinted the same way: a faint wash of the colour with the colour as text.
// Running uses the "reviewing" stage blue from docs/DESIGN.md and turns a small spinner while it works.
const STATUS: Record<Status, { label: string; className?: string }> = {
  queued: { label: 'Queued', className: 'bg-stage-queued/15 text-stage-queued' },
  running: { label: 'Running', className: 'bg-stage-reviewing/15 text-stage-reviewing' },
  posted: { label: 'Posted', className: 'bg-success/15 text-success' },
  failed: { label: 'Failed', className: 'bg-destructive/10 text-destructive' },
  skipped: { label: 'Skipped' },
};

export function ReviewStatusBadge({ status, title }: { status: Status; title?: string }) {
  const { label, className } = STATUS[status];
  return (
    <Badge variant={status === 'skipped' ? 'secondary' : 'outline'} className={cn(className)} title={title}>
      {status === 'running' && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />}
      {label}
    </Badge>
  );
}
