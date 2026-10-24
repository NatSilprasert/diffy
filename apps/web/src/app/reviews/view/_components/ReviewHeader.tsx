'use client';

import { AlertCircle, ExternalLink, Loader2, RotateCw } from 'lucide-react';
import type { GetReviewResponseDtoReview } from '@/api/generated/model';
import { ReviewStatusBadge } from '@/components/ReviewStatusBadge';
import { Button } from '@/components/ui/button';
import { formatDuration, timeAgo } from '@/lib/time';
import { useRetryAndRefresh } from '@/lib/useRetryAndRefresh';

// The top of the page: what was reviewed, how it went, and the things you can do about it.
export function ReviewHeader({ review }: { review: GetReviewResponseDtoReview }) {
  const retry = useRetryAndRefresh(review.id);

  const duration = formatDuration(review.createdAt, review.finishedAt);
  const working = review.status === 'queued' || review.status === 'running';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl leading-tight font-semibold tracking-[-0.02em]">
              <span className="font-normal text-muted-foreground">#{review.prNumber}</span> {review.prTitle}
            </h1>
            <ReviewStatusBadge status={review.status} />
          </div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="text-foreground/90">{review.repoFullName}</span>
            <span aria-hidden>·</span>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{review.headSha.slice(0, 7)}</code>
            <span aria-hidden>·</span>
            <span title={review.createdAt}>
              {timeAgo(review.createdAt)}
              {duration && `, took ${duration}`}
            </span>
          </p>
        </div>

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
                View review on GitHub
                <ExternalLink aria-hidden />
              </a>
            </Button>
          )}
        </div>
      </div>

      {working && (
        <div role="status" className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
          <span>
            {review.status === 'queued' ? 'Waiting for its turn.' : 'The model is reading the changes.'}{' '}
            <span className="text-muted-foreground">This page updates by itself.</span>
          </span>
        </div>
      )}

      {review.status === 'failed' && (
        <div role="alert" className="flex flex-wrap items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-destructive">The review failed</p>
            <p className="mt-1 break-words whitespace-pre-wrap text-foreground/90">{review.error ?? 'No reason was recorded.'}</p>
            {retry.isError && <p className="mt-2 text-destructive">{retry.error.message}</p>}
          </div>
          <Button size="sm" disabled={retry.isPending} onClick={() => retry.mutate({ id: review.id })}>
            <RotateCw className={retry.isPending ? 'animate-spin' : undefined} aria-hidden />
            {retry.isPending ? 'Retrying…' : 'Retry'}
          </Button>
        </div>
      )}
    </div>
  );
}
