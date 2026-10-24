'use client';

import { useState } from 'react';
import { useGetUsage } from '@/api/generated/diffy';
import { cn } from '@/lib/utils';
import { ReviewHeatmap } from './ReviewHeatmap';
import { UsageStatCards } from './UsageStatCards';
import { UsageTable, type UsageRow } from './UsageTable';

type Range = 'month' | 'allTime';
const RANGES: ReadonlyArray<{ value: Range; label: string }> = [
  { value: 'month', label: 'This month' },
  { value: 'allTime', label: 'All time' },
];

// What diffy has used: tokens and reviews, the busy days of the year, and who the tokens went to.
export function UsageSection() {
  const usage = useGetUsage({ query: { refetchInterval: 60_000 } });
  const [range, setRange] = useState<Range>('month');

  if (usage.isPending) return null;
  if (usage.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Could not load the usage: {usage.error.message}
      </p>
    );
  }
  const { allTime, month, byModel, byRepo, days } = usage.data;

  // Only what was used in the chosen range, with that range's numbers.
  const models: UsageRow[] = byModel
    .filter((m) => m[range].reviews > 0)
    .map((m) => ({ key: `${m.provider}/${m.model}`, name: m.model, hint: m.provider, ...m[range] }));
  const repos: UsageRow[] = byRepo
    .filter((r) => r[range].reviews > 0)
    .map((r) => ({ key: r.repositoryId, name: r.repoFullName, ...r[range] }));

  return (
    <div className="space-y-5">
      <UsageStatCards allTime={allTime} month={month} />
      <ReviewHeatmap days={days} />

      <div className="flex items-center justify-between gap-3 pt-1">
        <h2 className="text-lg font-semibold">Usage breakdown</h2>
        <div role="group" aria-label="Period" className="inline-flex rounded-lg border bg-card p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              aria-pressed={range === r.value}
              onClick={() => setRange(r.value)}
              className={cn(
                'rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                range === r.value && 'bg-secondary font-medium text-foreground',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <UsageTable title="By model" nameColumn="Model" rows={models} empty="No review has used a model in this period." />
        <UsageTable title="By repository" nameColumn="Repository" rows={repos} empty="No review in this period." />
      </div>
    </div>
  );
}
