'use client';

import { AlertCircle, ChevronRight, ExternalLink, Loader2, Maximize2, RotateCw } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ApiError } from '@/api/fetcher';
import { useGetReview } from '@/api/generated/diffy';
import type { GetReviewResponseDtoFindingsItem, GetReviewResponseDtoReview } from '@/api/generated/model';
import { ReviewStatusBadge } from '@/components/ReviewStatusBadge';
import { SEVERITY_ACCENT, SeverityBadge } from '@/components/SeverityBadge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { formatLocation, groupBySeverity } from '@/lib/findings';
import { formatDuration, timeAgo } from '@/lib/time';
import { useRetryAndRefresh } from '@/lib/useRetryAndRefresh';
import { cn } from '@/lib/utils';

// A review in a panel on the right. It is open whenever the address has ?review=<id>, on any page, so it
// can be linked to and the browser's Back button closes it. The full page (/reviews/view) keeps every detail.
export function ReviewDrawer() {
  const router = useRouter();
  const pathname = usePathname();
  const id = useSearchParams().get('review');

  return (
    <Sheet open={Boolean(id)} onOpenChange={(open) => !open && router.replace(pathname)}>
      <SheetContent aria-describedby={undefined}>{id && <DrawerBody id={id} />}</SheetContent>
    </Sheet>
  );
}

function DrawerBody({ id }: { id: string }) {
  const result = useGetReview(id, {
    query: {
      // Look again while it is still being worked on, until the result is in.
      refetchInterval: (query) => {
        const status = query.state.data?.review.status;
        return status === 'queued' || status === 'running' ? 4_000 : false;
      },
    },
  });

  if (result.isPending) {
    return (
      <>
        <SheetTitle className="sr-only">Review</SheetTitle>
        <p className="p-6 text-sm text-muted-foreground">Loading…</p>
      </>
    );
  }
  if (result.isError) {
    const notFound = result.error instanceof ApiError && result.error.status === 404;
    return (
      <>
        <SheetTitle className="p-6 pb-0">Review</SheetTitle>
        <p role="alert" className="p-6 text-sm text-destructive">
          {notFound ? 'This review does not exist.' : result.error.message}
        </p>
      </>
    );
  }

  const { review, findings } = result.data;
  return (
    <>
      <DrawerHeader review={review} />
      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        {review.summary && (
          <section aria-label="Summary">
            <h3 className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">Summary</h3>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{review.summary}</p>
          </section>
        )}
        <Findings review={review} findings={findings} />
      </div>
      <footer className="border-t px-6 py-3">
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href={`/reviews/view/?id=${encodeURIComponent(review.id)}`}>
            <Maximize2 aria-hidden />
            Open the full page for explanations, suggestions and fix prompts
          </Link>
        </Button>
      </footer>
    </>
  );
}

function DrawerHeader({ review }: { review: GetReviewResponseDtoReview }) {
  const retry = useRetryAndRefresh(review.id);
  const duration = formatDuration(review.createdAt, review.finishedAt);
  const working = review.status === 'queued' || review.status === 'running';

  return (
    <header className="space-y-3 border-b px-6 pt-5 pb-4 pr-12">
      <div className="flex flex-wrap items-center gap-2">
        <ReviewStatusBadge status={review.status} />
        <span className="text-xs text-muted-foreground" title={review.createdAt}>
          {timeAgo(review.createdAt)}
          {duration && `, took ${duration}`}
        </span>
      </div>
      <SheetTitle>
        <span className="font-normal text-muted-foreground">#{review.prNumber}</span> {review.prTitle}
      </SheetTitle>
      <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>{review.repoFullName}</span>
        <span aria-hidden>·</span>
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{review.headSha.slice(0, 7)}</code>
      </SheetDescription>

      {review.model && <ModelUsage review={review} />}

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <a href={review.prUrl} target="_blank" rel="noreferrer">
            Pull request
            <ExternalLink aria-hidden />
          </a>
        </Button>
        {review.githubReviewUrl && (
          <Button asChild size="sm">
            <a href={review.githubReviewUrl} target="_blank" rel="noreferrer">
              Review on GitHub
              <ExternalLink aria-hidden />
            </a>
          </Button>
        )}
      </div>

      {working && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {review.status === 'queued' ? 'Waiting for its turn.' : 'The model is reading the changes.'}
        </p>
      )}

      {review.status === 'failed' && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-destructive">The review failed</p>
            <p className="mt-0.5 line-clamp-4 break-words whitespace-pre-wrap text-foreground/90" title={review.error ?? undefined}>
              {review.error ?? 'No reason was recorded.'}
            </p>
            {retry.isError && <p className="mt-1 text-destructive">{retry.error.message}</p>}
          </div>
          <Button size="sm" disabled={retry.isPending} onClick={() => retry.mutate({ id: review.id })}>
            <RotateCw className={retry.isPending ? 'animate-spin' : undefined} aria-hidden />
            {retry.isPending ? 'Queuing…' : 'Re-review'}
          </Button>
        </div>
      )}
    </header>
  );
}

// Which model wrote the review and how many tokens it used, when that was recorded.
function ModelUsage({ review }: { review: GetReviewResponseDtoReview }) {
  const hasTokens = review.inputTokens !== null || review.outputTokens !== null;
  return (
    <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-background px-3 py-2 text-xs">
      <div className="flex items-center gap-1.5">
        <dt className="text-muted-foreground">Model</dt>
        <dd className="font-medium">
          {review.provider ? `${review.provider} / ` : ''}
          {review.model}
        </dd>
      </div>
      {hasTokens && (
        <div className="flex items-center gap-1.5">
          <dt className="text-muted-foreground">Tokens</dt>
          <dd className="font-medium tabular-nums">
            {review.inputTokens?.toLocaleString() ?? '?'} in · {review.outputTokens?.toLocaleString() ?? '?'} out
          </dd>
        </div>
      )}
    </dl>
  );
}

// One line per finding: how bad, what, where. Click one for the model's explanation; nothing more here.
function Findings({ review, findings }: { review: GetReviewResponseDtoReview; findings: GetReviewResponseDtoFindingsItem[] }) {
  if (findings.length === 0) {
    return review.status === 'posted' ? (
      <p className="text-sm text-muted-foreground">The model found nothing to report in this change.</p>
    ) : null;
  }
  const groups = groupBySeverity(findings);

  return (
    <section aria-label="Findings" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">
          {findings.length} finding{findings.length === 1 ? '' : 's'}
        </h3>
        {groups.map((group) => (
          <SeverityBadge key={group.severity} severity={group.severity} count={group.findings.length} />
        ))}
      </div>
      <ul className="space-y-2">
        {groups
          .flatMap((group) => group.findings)
          .map((finding) => (
            <li key={finding.id}>
              <details className={cn('group overflow-hidden rounded-lg border border-l-4 bg-background', SEVERITY_ACCENT[finding.severity])}>
                <summary className="flex cursor-pointer list-none items-start gap-2 px-3 py-2.5 select-none [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-2">
                      <SeverityBadge severity={finding.severity} />
                      <span className="text-sm leading-snug font-medium">{finding.title}</span>
                    </span>
                    <code className="mt-1 block truncate text-xs text-muted-foreground">{formatLocation(finding)}</code>
                  </span>
                </summary>
                <p className="border-t px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{finding.explanation}</p>
              </details>
            </li>
          ))}
      </ul>
    </section>
  );
}
