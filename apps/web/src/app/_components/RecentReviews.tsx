'use client';

import Link from 'next/link';
import { useListReviews } from '@/api/generated/diffy';
import { ReviewsTable } from '@/components/ReviewsTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function RecentReviews() {
  const reviews = useListReviews(
    { limit: 10 },
    {
      query: {
        // Keep looking while something is queued or running; otherwise the page stays as it is.
        refetchInterval: (query) =>
          query.state.data?.reviews.some((r) => r.status === 'queued' || r.status === 'running') ? 5_000 : false,
      },
    },
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recent reviews</CardTitle>
          <Link href="/reviews/" className="text-sm underline-offset-2 hover:underline">
            See all
          </Link>
        </div>
      </CardHeader>
      <CardContent className={reviews.isError && reviews.data ? 'opacity-50' : undefined}>
        {reviews.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        {reviews.isError && <p className="text-sm text-destructive">{reviews.error.message}</p>}
        {reviews.data && reviews.data.reviews.length === 0 && (
          <p className="text-sm text-muted-foreground">No reviews yet. They show up here as soon as Diffy reviews a pull request.</p>
        )}
        {reviews.data && reviews.data.reviews.length > 0 && <ReviewsTable reviews={reviews.data.reviews} />}
      </CardContent>
    </Card>
  );
}
