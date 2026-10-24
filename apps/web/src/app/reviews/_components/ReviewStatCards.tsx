'use client';

import { useGetReviewStats } from '@/api/generated/diffy';
import type { ListReviewsPeriod } from '@/api/generated/model';
import { StatCards, type StatCard } from '@/components/StatCards';

type Key = 'total' | ListReviewsPeriod;

// Four counts that double as the time filter. Pressing the selected one again goes back to all reviews.
export function ReviewStatCards({
  period,
  onChange,
}: {
  period: ListReviewsPeriod | null;
  onChange: (period: ListReviewsPeriod | null) => void;
}) {
  const stats = useGetReviewStats({ query: { refetchInterval: 15_000 } });
  const selected: Key = period ?? 'total';

  const cards: StatCard<Key>[] = [
    { key: 'total', label: 'Total reviews', value: stats.data?.total },
    { key: 'month', label: 'This month', value: stats.data?.month },
    { key: 'week', label: 'This week', value: stats.data?.week },
    { key: 'day', label: 'Last 24 hours', value: stats.data?.day },
  ];

  return (
    <StatCards
      label="Filter by time"
      cards={cards}
      selected={selected}
      unavailable={stats.isError}
      onSelect={(key) => onChange(key === selected || key === 'total' ? null : key)}
    />
  );
}
