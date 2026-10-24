'use client';

import { useGetReviewStats } from '@/api/generated/diffy';
import type { ListReviewsPeriod } from '@/api/generated/model';
import { cn } from '@/lib/utils';

type Card = { period: ListReviewsPeriod | null; label: string; count: 'total' | ListReviewsPeriod };

const CARDS: Card[] = [
  { period: null, label: 'Total reviews', count: 'total' },
  { period: 'month', label: 'This month', count: 'month' },
  { period: 'week', label: 'This week', count: 'week' },
  { period: 'day', label: 'Last 24 hours', count: 'day' },
];

// Four counts that double as the time filter: the selected card is the window the table below shows.
export function ReviewStatCards({
  period,
  onChange,
}: {
  period: ListReviewsPeriod | null;
  onChange: (period: ListReviewsPeriod | null) => void;
}) {
  const stats = useGetReviewStats({ query: { refetchInterval: 15_000 } });

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="group" aria-label="Filter by time">
      {CARDS.map((card) => {
        const selected = period === card.period;
        const value = stats.data?.[card.count];
        return (
          <button
            key={card.label}
            type="button"
            aria-pressed={selected}
            // Pressing the selected window again goes back to all reviews.
            onClick={() => onChange(selected ? null : card.period)}
            className={cn(
              'cursor-pointer rounded-xl border bg-card p-1 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              selected && 'border-primary ring-2 ring-primary hover:bg-card',
            )}
          >
            <span className="block px-3 pt-2 pb-2 text-sm text-foreground">{card.label}</span>
            <span className="block rounded-lg bg-background px-3 py-3 text-2xl font-semibold tabular-nums">
              {value ?? (stats.isError ? '–' : '…')}
            </span>
          </button>
        );
      })}
    </div>
  );
}
