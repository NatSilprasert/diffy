import type { GetReviewResponseDtoReview } from '@/api/generated/model';

// The facts about how the review was made. Only rows that have a value are shown.
export function ReviewMeta({ review, findingCount }: { review: GetReviewResponseDtoReview; findingCount: number }) {
  const rows: Array<[string, React.ReactNode]> = [
    ['Repository', review.repoFullName],
    ['Commit', <code key="sha" title={review.headSha} className="rounded bg-muted px-1.5 py-0.5 text-xs">{review.headSha.slice(0, 12)}</code>],
    ['Started', new Date(review.createdAt).toLocaleString()],
  ];
  if (review.model) rows.push(['Model', `${review.provider ? `${review.provider} / ` : ''}${review.model}`]);
  if (review.inputTokens !== null || review.outputTokens !== null) {
    rows.push([
      'Tokens',
      <span key="tok" className="tabular-nums">
        {review.inputTokens?.toLocaleString() ?? '?'} in · {review.outputTokens?.toLocaleString() ?? '?'} out
      </span>,
    ]);
  }
  if (review.status === 'posted') rows.push(['Findings', String(findingCount)]);

  return (
    <section aria-label="Details" className="rounded-xl border bg-card">
      <h2 className="border-b px-4 py-3 text-sm font-medium">Details</h2>
      <dl className="divide-y text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
            <dt className="shrink-0 text-muted-foreground">{label}</dt>
            <dd className="min-w-0 text-right break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
