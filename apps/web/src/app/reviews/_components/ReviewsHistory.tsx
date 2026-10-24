'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { getListReviewsQueryKey, listReviews, useListRepos } from '@/api/generated/diffy';
import type { ListReviewsParams, ListReviewsStatus } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ReviewRow } from './ReviewRow';

const PAGE_SIZE = 20;
// "All" cannot be an empty string in a Select, so it gets a value that no repository id or status uses.
const ALL = 'all';

const STATUSES: ReadonlyArray<{ value: ListReviewsStatus; label: string }> = [
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'posted', label: 'Posted' },
  { value: 'failed', label: 'Failed' },
  { value: 'skipped', label: 'Skipped' },
];

export function ReviewsHistory() {
  const [repositoryId, setRepositoryId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const repos = useListRepos();

  const filters: ListReviewsParams = {
    ...(repositoryId !== ALL ? { repositoryId } : {}),
    ...(status !== ALL ? { status: status as ListReviewsStatus } : {}),
  };

  const reviews = useInfiniteQuery({
    // A different key per filter: changing a filter starts again from the first page.
    queryKey: [...getListReviewsQueryKey(filters), 'infinite'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => listReviews({ ...filters, limit: PAGE_SIZE, cursor: pageParam }, { signal }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    // While something is queued or running its status will change, so keep looking until it settles.
    refetchInterval: (query) =>
      query.state.data?.pages.some((page) => page.reviews.some((r) => r.status === 'queued' || r.status === 'running'))
        ? 5_000
        : false,
  });

  const rows = reviews.data?.pages.flatMap((page) => page.reviews) ?? [];
  const filtered = repositoryId !== ALL || status !== ALL;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="filter-repo">Repository</Label>
          <Select value={repositoryId} onValueChange={setRepositoryId}>
            <SelectTrigger id="filter-repo" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All repositories</SelectItem>
              {repos.data?.repos.map((repo) => (
                <SelectItem key={repo.id} value={repo.id}>
                  {repo.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-status">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="filter-status" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any status</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRepositoryId(ALL);
              setStatus(ALL);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <Card>
        <CardContent>
          {reviews.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
          {reviews.isError && <p className="text-sm text-destructive">{reviews.error.message}</p>}

          {reviews.isSuccess && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {filtered ? (
                'No review matches these filters.'
              ) : (
                <>
                  No reviews yet. They appear here when a repository you{' '}
                  <Link href="/repos/" className="underline">
                    watch
                  </Link>{' '}
                  gets a new pull request or a new commit.
                </>
              )}
            </p>
          )}

          {rows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Repository</TableHead>
                  <TableHead>Pull request</TableHead>
                  <TableHead>Commit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Findings</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((review) => (
                  <ReviewRow key={review.id} review={review} />
                ))}
              </TableBody>
            </Table>
          )}

          {reviews.hasNextPage && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" disabled={reviews.isFetchingNextPage} onClick={() => reviews.fetchNextPage()}>
                {reviews.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
