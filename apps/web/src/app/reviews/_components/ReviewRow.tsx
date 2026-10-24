import Link from 'next/link';
import type { ListReviewsResponseDtoReviewsItem } from '@/api/generated/model';
import { ReviewStatusBadge } from '@/components/ReviewStatusBadge';
import { SEVERITIES, SeverityBadge } from '@/components/SeverityBadge';
import { TableCell, TableRow } from '@/components/ui/table';
import { timeAgo } from '@/lib/time';

export function ReviewRow({ review }: { review: ListReviewsResponseDtoReviewsItem }) {
  const found = SEVERITIES.filter((severity) => review.findingCounts[severity] > 0);

  return (
    <TableRow>
      <TableCell className="align-top text-sm text-muted-foreground whitespace-nowrap" title={review.createdAt}>
        {timeAgo(review.createdAt)}
      </TableCell>
      <TableCell className="align-top text-sm">{review.repoFullName}</TableCell>
      <TableCell className="max-w-xs align-top">
        <a
          href={review.prUrl}
          target="_blank"
          rel="noreferrer"
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
      <TableCell className="align-top">
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{review.headSha.slice(0, 7)}</code>
      </TableCell>
      <TableCell className="align-top">
        <ReviewStatusBadge status={review.status} />
      </TableCell>
      <TableCell className="align-top">
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
      <TableCell className="align-top text-right">
        <Link href={`/reviews/view/?id=${encodeURIComponent(review.id)}`} className="text-sm underline-offset-2 hover:underline">
          Open
        </Link>
      </TableCell>
    </TableRow>
  );
}
