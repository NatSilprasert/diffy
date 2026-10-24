'use client';

import { CheckCircle2, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ApiError } from '@/api/fetcher';
import { useGetReview } from '@/api/generated/diffy';
import { PageHeader } from '@/components/PageHeader';
import { SeverityBadge } from '@/components/SeverityBadge';
import { groupBySeverity } from '@/lib/findings';
import { FindingCard } from './FindingCard';
import { ReviewHeader } from './ReviewHeader';
import { ReviewMeta } from './ReviewMeta';

function BackLink() {
  return (
    <Link href="/reviews/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ChevronLeft className="size-4" aria-hidden />
      All reviews
    </Link>
  );
}

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
      <>
        <PageHeader title="Review" description="A single review and everything it found." />
        <p className="text-sm text-muted-foreground">
          No review selected. Pick one from the{' '}
          <Link href="/reviews/" className="underline">
            list of reviews
          </Link>
          .
        </p>
      </>
    );
  }
  if (result.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (result.isError) {
    const notFound = result.error instanceof ApiError && result.error.status === 404;
    return (
      <>
        <PageHeader title="Review" description="A single review and everything it found." />
        <p role="alert" className="text-sm text-destructive">
          {notFound ? 'This review does not exist.' : result.error.message}{' '}
          <Link href="/reviews/" className="underline">
            Back to the list
          </Link>
        </p>
      </>
    );
  }

  const { review, findings } = result.data;
  const groups = groupBySeverity(findings);
  // A failed or waiting review has no summary and no findings: then the details are the whole page.
  const hasContent = Boolean(review.summary) || findings.length > 0 || review.status === 'posted';

  return (
    <div className="space-y-6">
      <BackLink />
      <ReviewHeader review={review} />

      <div className={hasContent ? 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]' : 'max-w-xl'}>
        {/* The details come first in the markup so they sit above the findings on a narrow screen. */}
        <div className={hasContent ? 'lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1' : undefined}>
          <ReviewMeta review={review} findingCount={findings.length} />
        </div>

        {hasContent && (
        <div className="space-y-8 lg:col-start-1 lg:row-start-1">
          {review.summary && (
            <section aria-label="Summary" className="rounded-xl border bg-card px-5 py-4">
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">Summary</h2>
              <p className="max-w-3xl leading-relaxed whitespace-pre-wrap text-foreground/90">{review.summary}</p>
            </section>
          )}

          {review.status === 'posted' && findings.length === 0 && (
            <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-4 text-sm">
              <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
              <span>The model found nothing to report in this change.</span>
            </div>
          )}

          {groups.length > 0 && (
            <section aria-label="Findings" className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold">
                  {findings.length} finding{findings.length === 1 ? '' : 's'}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {groups.map((group) => (
                    <SeverityBadge key={group.severity} severity={group.severity} count={group.findings.length} />
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {groups.flatMap((group) => group.findings).map((finding) => (
                  <FindingCard key={finding.id} finding={finding} />
                ))}
              </div>
            </section>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
