'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { getListReviewsQueryKey, listReviews, useListRepos } from '@/api/generated/diffy';
import type { ListReviewsParams, ListReviewsPeriod, ListReviewsStatus } from '@/api/generated/model';
import { ReviewsTable } from '@/components/ReviewsTable';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { ReviewStatCards } from './ReviewStatCards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const [period, setPeriod] = useState<ListReviewsPeriod | null>(null);
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim());
  const repos = useListRepos();

  const filters: ListReviewsParams = {
    ...(repositoryId !== ALL ? { repositoryId } : {}),
    ...(status !== ALL ? { status: status as ListReviewsStatus } : {}),
    ...(period ? { period } : {}),
    ...(q ? { q } : {}),
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
  const filtered = repositoryId !== ALL || status !== ALL || period !== null || search.trim() !== '';

  return (
    <div className="space-y-5">
      <ReviewStatCards period={period} onChange={setPeriod} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, repo, #12 or commit"
            aria-label="Search reviews"
            className="h-9 pl-9"
          />
        </div>
        <Select value={repositoryId} onValueChange={setRepositoryId}>
          <SelectTrigger aria-label="Repository" className="h-9 w-52">
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
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Status" className="h-9 w-40">
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
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRepositoryId(ALL);
              setStatus(ALL);
              setPeriod(null);
              setSearch('');
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {reviews.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        {reviews.isError && <p className="text-sm text-destructive">{reviews.error.message}</p>}

        {reviews.isSuccess && rows.length === 0 && (
          <p className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
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

        {rows.length > 0 && <ReviewsTable reviews={rows} />}

        {reviews.hasNextPage && (
          <div className="flex justify-center">
            <Button variant="outline" disabled={reviews.isFetchingNextPage} onClick={() => reviews.fetchNextPage()}>
              {reviews.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
