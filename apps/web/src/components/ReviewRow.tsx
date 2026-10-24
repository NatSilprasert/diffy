'use client';

import { ChevronRight, RotateCw } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ListReviewsResponseDtoReviewsItem } from '@/api/generated/model';
import { ReviewStatusBadge } from '@/components/ReviewStatusBadge';
import { SeverityBadge } from '@/components/SeverityBadge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { SEVERITY_ORDER } from '@/lib/findings';
import { timeAgo } from '@/lib/time';
import { useRetryAndRefresh } from '@/lib/useRetryAndRefresh';

// A click anywhere on the row opens the review. The links and the button inside stop that click,
// and the chevron is a real link so the keyboard can reach the same place.
const stop = (event: React.SyntheticEvent) => event.stopPropagation();

export function ReviewRow({ review }: { review: ListReviewsResponseDtoReviewsItem }) {
  const router = useRouter();
  const pathname = usePathname();
  const found = SEVERITY_ORDER.filter((severity) => review.findingCounts[severity] > 0);
  // The review opens in a panel over the current page: the page address just gains ?review=<id>.
  const href = `${pathname}?review=${encodeURIComponent(review.id)}`;

  const retry = useRetryAndRefresh(review.id);

  return (
    <TableRow className="cursor-pointer border-border bg-card hover:bg-secondary/60" onClick={() => router.push(href)}>
      <TableCell className="px-4 py-3.5 align-top text-sm whitespace-nowrap text-muted-foreground" title={review.createdAt}>
        {timeAgo(review.createdAt)}
      </TableCell>
      <TableCell className="px-4 py-3.5 align-top text-sm">{review.repoFullName}</TableCell>
      <TableCell className="max-w-xs px-4 py-3.5 align-top">
        <a
          href={review.prUrl}
          target="_blank"
          rel="noreferrer"
          onClick={stop}
          className="text-sm font-medium underline-offset-2 hover:underline"
        >
          #{review.prNumber} {review.prTitle}
        </a>
        {review.status === 'failed' && review.error && (
          <p className="mt-1 line-clamp-2 break-words text-xs text-destructive" title={review.error}>
            {review.error}
          </p>
        )}
      </TableCell>
      <TableCell className="px-4 py-3.5 align-top">
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{review.headSha.slice(0, 7)}</code>
      </TableCell>
      <TableCell className="px-4 py-3.5 align-top">
        <ReviewStatusBadge status={review.status} />
      </TableCell>
      <TableCell className="px-4 py-3.5 align-top">
        {found.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {found.map((severity) => (
              <SeverityBadge key={severity} severity={severity} count={review.findingCounts[severity]} />
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">{review.status === 'posted' ? 'No findings' : '–'}</span>
        )}
      </TableCell>
      <TableCell className="px-4 py-3 align-top" onClick={stop}>
        <div className="flex items-center justify-end gap-2">
          {review.status === 'failed' && (
            <div className="flex flex-col items-end gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={retry.isPending}
                onClick={() => retry.mutate({ id: review.id })}
              >
                <RotateCw className={retry.isPending ? 'animate-spin' : undefined} aria-hidden />
                {retry.isPending ? 'Queuing…' : 'Re-review'}
              </Button>
              {retry.isError && (
                <span role="alert" className="max-w-40 text-right text-xs text-destructive">
                  {retry.error.message}
                </span>
              )}
            </div>
          )}
          <Link
            href={href}
            aria-label={`Open review of #${review.prNumber} ${review.prTitle}`}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
      </TableCell>
    </TableRow>
  );
}
