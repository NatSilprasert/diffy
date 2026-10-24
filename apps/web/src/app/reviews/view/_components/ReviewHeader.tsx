'use client';

import { useQueryClient } from '@tanstack/react-query';
import { getGetReviewQueryKey, getListReviewsQueryKey, useRetryReview } from '@/api/generated/diffy';
import type { GetReviewResponseDtoReview } from '@/api/generated/model';
import { ReviewStatusBadge } from '@/components/ReviewStatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDuration, timeAgo } from '@/lib/time';

export function ReviewHeader({ review }: { review: GetReviewResponseDtoReview }) {
  const queryClient = useQueryClient();
  const retry = useRetryReview({
    mutation: {
      onSuccess: async () => {
        // The detail goes back to "queued" and the history page must show that too.
        await queryClient.invalidateQueries({ queryKey: getGetReviewQueryKey(review.id) });
        await queryClient.invalidateQueries({ queryKey: getListReviewsQueryKey().slice(0, 1) });
      },
    },
  });

  const duration = formatDuration(review.createdAt, review.finishedAt);
  const tokens =
    review.inputTokens !== null || review.outputTokens !== null
      ? `${review.inputTokens?.toLocaleString() ?? '?'} in / ${review.outputTokens?.toLocaleString() ?? '?'} out`
      : null;
  const working = review.status === 'queued' || review.status === 'running';

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">
            <a href={review.prUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
              #{review.prNumber} {review.prTitle}
            </a>
          </h2>
          <ReviewStatusBadge status={review.status} />
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Repository</dt>
          <dd>{review.repoFullName}</dd>
          <dt className="text-muted-foreground">Commit</dt>
          <dd>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{review.headSha.slice(0, 7)}</code>
          </dd>
          <dt className="text-muted-foreground">Started</dt>
          <dd title={review.createdAt}>
            {timeAgo(review.createdAt)}
            {duration && `, took ${duration}`}
          </dd>
          {review.model && (
            <>
              <dt className="text-muted-foreground">Model</dt>
              <dd>
                {review.provider ? `${review.provider} / ` : ''}
                {review.model}
                {tokens && <span className="text-muted-foreground"> ({tokens} tokens)</span>}
              </dd>
            </>
          )}
        </dl>

        {working && (
          <p className="text-sm text-muted-foreground" role="status">
            {review.status === 'queued' ? 'Waiting for its turn.' : 'The model is reading the changes.'} This page updates by itself.
          </p>
        )}

        {review.status === 'failed' && (
          <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <p className="font-medium text-destructive">The review failed</p>
            <p className="mt-1 whitespace-pre-wrap break-words">{review.error ?? 'No reason was recorded.'}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {review.githubReviewUrl && (
            <Button asChild variant="outline" size="sm">
              <a href={review.githubReviewUrl} target="_blank" rel="noreferrer">
                View the review on GitHub
              </a>
            </Button>
          )}
          {review.status === 'failed' && (
            <Button size="sm" disabled={retry.isPending} onClick={() => retry.mutate({ id: review.id })}>
              {retry.isPending ? 'Retrying…' : 'Retry'}
            </Button>
          )}
          {retry.isError && (
            <span role="alert" className="text-sm text-destructive">
              {retry.error.message}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
