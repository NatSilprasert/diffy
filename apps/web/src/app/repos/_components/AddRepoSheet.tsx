'use client';

import { keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { Lock, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ApiError } from '@/api/fetcher';
import { getListReposQueryKey, useAddRepo, useListAvailableRepos, useListRepos } from '@/api/generated/diffy';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

// Search the repositories the GitHub token can see and watch one. A panel on the right, like a review.
export function AddRepoSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <header className="space-y-1.5 border-b px-6 pt-5 pr-12 pb-4">
          <SheetTitle>Add a repository</SheetTitle>
          <SheetDescription>
            Pick one of the repositories your GitHub token can see. Pull requests already open stay as they are; only new ones are reviewed.
          </SheetDescription>
        </header>
        {/* The body only exists while the panel is open, so each opening starts with an empty search. */}
        <AddRepoBody />
      </SheetContent>
    </Sheet>
  );
}

function AddRepoBody() {
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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 px-6 py-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            autoFocus
            autoComplete="off"
            spellCheck={false}
            type="search"
            aria-label="Search your repositories"
            placeholder="owner/name"
            className="h-10 pl-9"
            value={query}
            onChange={(event) => {
              // An error from an earlier "Add" belongs to the earlier search, not to the one being typed.
              add.reset();
              setQuery(event.target.value);
            }}
          />
        </div>
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
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {available.isSuccess && repos.length === 0 && (
          <p className="text-sm text-muted-foreground">{search ? `No repository matches "${search}".` : 'Your token cannot see any repository.'}</p>
        )}

        {repos.length > 0 && (
          <ul className="divide-y overflow-hidden rounded-xl border bg-background">
            {repos.map((repo) => {
              const isWatched = watchedNames.has(repo.fullName.toLowerCase());
              const [owner, name] = repo.fullName.split('/');
              return (
                <li key={repo.fullName} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <span className="truncate">
                      <span className="text-muted-foreground">{owner}/</span>
                      <span className="font-medium">{name}</span>
                    </span>
                    {repo.isPrivate && (
                      <Badge variant="secondary" className="gap-1">
                        <Lock aria-hidden />
                        private
                      </Badge>
                    )}
                  </span>
                  {isWatched ? (
                    <Badge className="bg-success/15 text-success">Watching</Badge>
                  ) : (
                    <Button size="sm" variant="outline" disabled={add.isPending} onClick={() => add.mutate({ data: { fullName: repo.fullName } })}>
                      {adding === repo.fullName ? 'Adding…' : 'Add'}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {available.data?.hasMore && (
          <p className="mt-3 text-xs text-muted-foreground">Showing the first {repos.length} matches. Type more of the name to narrow it down.</p>
        )}
      </div>
    </div>
  );
}
