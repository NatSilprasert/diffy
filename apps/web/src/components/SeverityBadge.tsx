import { Badge } from '@/components/ui/badge';
import type { Severity } from '@/lib/findings';
import { cn } from '@/lib/utils';

const SEVERITY: Record<Severity, { label: string; className: string }> = {
  critical: { label: 'Critical', className: 'border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400' },
  high: { label: 'High', className: 'border-orange-500/30 bg-orange-500/15 text-orange-600 dark:text-orange-400' },
  medium: { label: 'Medium', className: 'border-yellow-500/30 bg-yellow-500/15 text-yellow-700 dark:text-yellow-400' },
  low: { label: 'Low', className: 'border-sky-500/30 bg-sky-500/15 text-sky-600 dark:text-sky-400' },
};

// The colour carries the severity but not alone: the word is always there.
export function SeverityBadge({ severity, count }: { severity: Severity; count?: number }) {
  const { label, className } = SEVERITY[severity];
  return (
    <Badge variant="outline" className={cn(className)}>
      {count === undefined ? label : `${count} ${label.toLowerCase()}`}
    </Badge>
  );
}
