'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ApiError } from '@/api/fetcher';
import { useGetReview } from '@/api/generated/diffy';
import { SeverityBadge } from '@/components/SeverityBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { groupBySeverity } from '@/lib/findings';
import { FindingCard } from './FindingCard';
import { ReviewHeader } from './ReviewHeader';

export function ReviewDetail() {
  // One review is addressed as ?id=..., because a static export cannot serve ids it does not know at build time.
  const id = useSearchParams().get('id');

  const result = useGetReview(id ?? '', {
    query: {
      enabled: Boolean(id),
      // Look again while it is still being worked on, until the result is in.
      refetchInterval: (query) => {
        const status = query.state.data?.review.status;
        return status === 'queued' || status === 'running' ? 4_000 : false;
      },
    },
  });

  if (!id) {
    return (
      <p className="text-sm text-muted-foreground">
        No review selected. Pick one from the{' '}
        <Link href="/reviews/" className="underline">
          list of reviews
        </Link>
        .
      </p>
    );
  }
  if (result.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (result.isError) {
    const notFound = result.error instanceof ApiError && result.error.status === 404;
    return (
      <p role="alert" className="text-sm text-destructive">
        {notFound ? 'This review does not exist.' : result.error.message}{' '}
        <Link href="/reviews/" className="underline">
          Back to the list
        </Link>
      </p>
    );
  }

  const { review, findings } = result.data;
  const groups = groupBySeverity(findings);

  return (
    <div className="space-y-6">
      <Link href="/reviews/" className="text-sm text-muted-foreground underline-offset-2 hover:underline">
        ← All reviews
      </Link>

      <ReviewHeader review={review} />

      {review.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{review.summary}</p>
          </CardContent>
        </Card>
      )}

      {review.status === 'posted' && findings.length === 0 && (
        <p className="text-sm text-muted-foreground">The model found nothing to report in this change.</p>
      )}

      {groups.length > 0 && (
        <section className="space-y-6" aria-label="Findings">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">
              {findings.length} finding{findings.length === 1 ? '' : 's'}
            </h2>
            {groups.map((group) => (
              <SeverityBadge key={group.severity} severity={group.severity} count={group.findings.length} />
            ))}
          </div>

          {groups.map((group) => (
            <div key={group.severity} className="space-y-3">
              {group.findings.map((finding) => (
                <FindingCard key={finding.id} finding={finding} />
              ))}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
