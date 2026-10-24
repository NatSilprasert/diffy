'use client';

import { cn } from '@/lib/utils';

export type StatCard<K extends string> = { key: K; label: string; value: number | undefined };

// A row of counts that are also a filter: the selected card is the one the table below is showing.
// `unavailable` shows a dash instead of the loading mark, for when the counts could not be read.
export function StatCards<K extends string>({
  cards,
  selected,
  onSelect,
  label,
  unavailable = false,
}: {
  cards: ReadonlyArray<StatCard<K>>;
  selected: K;
  onSelect: (key: K) => void;
  label: string;
  unavailable?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="group" aria-label={label}>
      {cards.map((card) => {
        const isSelected = card.key === selected;
        return (
          <button
            key={card.key}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(card.key)}
            className={cn(
              'rounded-xl border bg-card p-1 text-left transition-colors hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              isSelected && 'border-primary ring-2 ring-primary hover:bg-card',
            )}
          >
            <span className="block px-3 pt-2 pb-2 text-sm text-foreground">{card.label}</span>
            <span className="block rounded-lg bg-background px-3 py-3 text-2xl font-semibold tabular-nums">
              {card.value ?? (unavailable ? '–' : '…')}
            </span>
          </button>
        );
      })}
    </div>
  );
}
