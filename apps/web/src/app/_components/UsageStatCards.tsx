import type { GetUsageResponseDtoAllTime } from '@/api/generated/model';
import { StatTile } from '@/components/StatTile';
import { formatTokens } from '@/lib/format';

type Totals = GetUsageResponseDtoAllTime;

const tokens = (t: Totals) => t.inputTokens + t.outputTokens;
const split = (t: Totals) => `${formatTokens(t.inputTokens)} in · ${formatTokens(t.outputTokens)} out`;
const exact = (t: Totals) => `${t.inputTokens.toLocaleString()} input + ${t.outputTokens.toLocaleString()} output tokens`;
const reviews = (t: Totals) => `${t.reviews.toLocaleString()} review${t.reviews === 1 ? '' : 's'}`;

// Tokens and review counts for this month and for all time. These do not filter anything; they are just the numbers.
export function UsageStatCards({ allTime, month }: { allTime: Totals; month: Totals }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile label="Tokens this month" value={formatTokens(tokens(month))} detail={split(month)} title={exact(month)} />
      <StatTile label="Tokens, all time" value={formatTokens(tokens(allTime))} detail={split(allTime)} title={exact(allTime)} />
      <StatTile label="Reviews this month" value={month.reviews.toLocaleString()} detail={`${formatTokens(tokens(month))} tokens`} />
      <StatTile label="Reviews, all time" value={allTime.reviews.toLocaleString()} detail={`${formatTokens(tokens(allTime))} tokens`} />
    </div>
  );
}
