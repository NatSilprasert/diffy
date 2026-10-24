'use client';

import { keepPreviousData, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { ApiError } from '@/api/fetcher';
import { getListReposQueryKey, useAddRepo, useListAvailableRepos, useListRepos } from '@/api/generated/diffy';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

export function AddRepoCard() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  // Ask the server once the user pauses typing, not on every keystroke.
  const search = useDebouncedValue(query.trim(), 300);

  const available = useListAvailableRepos(
    { q: search || undefined },
    // Keep showing the previous results while the next search loads, so the list does not flash empty.
    { query: { placeholderData: keepPreviousData } },
  );
  const watching = useListRepos();
  const add = useAddRepo({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListReposQueryKey() }) },
  });

  const watchedNames = new Set(watching.data?.repos.map((repo) => repo.fullName.toLowerCase()));
  const repos = available.data?.repos ?? [];
  const adding = add.isPending ? add.variables.data.fullName : undefined;
  const notConnected = available.error instanceof ApiError && available.error.status === 400;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a repository</CardTitle>
        <CardDescription>Pick one of the repositories your GitHub token can see. Pull requests already open stay as they are; only new ones are reviewed.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="repo-search">Search your repositories</Label>
          <Input
            id="repo-search"
            autoComplete="off"
            spellCheck={false}
            className="sm:w-96"
            placeholder="owner/name"
            value={query}
            onChange={(event) => {
              // An error from an earlier "Add" belongs to the earlier search, not to the one being typed.
              add.reset();
              setQuery(event.target.value);
            }}
          />
        </div>

        {available.isPending && (
          <p className="text-sm text-muted-foreground">Loading your repositories from GitHub… the first load can take a few seconds.</p>
        )}
        {/* Every search asks GitHub again, which takes a few seconds with many repositories. The old results stay
            on screen meanwhile, so say that new ones are coming. */}
        {available.isPlaceholderData && available.isFetching && (
          <p role="status" className="text-sm text-muted-foreground">
            Searching…
          </p>
        )}
        {available.isError && (
          <p role="alert" className="text-sm text-destructive">
            {available.error.message}{' '}
            {notConnected && (
              <Link href="/settings/" className="underline">
                Open settings
              </Link>
            )}
          </p>
        )}
        {add.isError && (
          <p role="alert" className="text-sm text-destructive">
            {add.error.message}
          </p>
        )}

        {available.isSuccess && repos.length === 0 && (
          <p className="text-sm text-muted-foreground">{search ? `No repository matches "${search}".` : 'Your token cannot see any repository.'}</p>
        )}

        {repos.length > 0 && (
          <ul className="divide-y rounded-md border">
            {repos.map((repo) => {
              const isWatched = watchedNames.has(repo.fullName.toLowerCase());
              return (
                <li key={repo.fullName} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <span className="truncate">{repo.fullName}</span>
                    {repo.isPrivate && <Badge variant="secondary">private</Badge>}
                  </span>
                  {isWatched ? (
                    <Badge>Watching</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={add.isPending}
                      onClick={() => add.mutate({ data: { fullName: repo.fullName } })}
                    >
                      {adding === repo.fullName ? 'Adding…' : 'Add'}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {available.data?.hasMore && (
          <p className="text-xs text-muted-foreground">Showing the first {repos.length} matches. Type more of the name to narrow it down.</p>
        )}
      </CardContent>
    </Card>
  );
}
