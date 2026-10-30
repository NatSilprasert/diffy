'use client';

import { FolderPlus, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { useListProfiles, useListRepos } from '@/api/generated/diffy';
import type { ListReposResponseDtoReposItem } from '@/api/generated/model';
import { DataTable } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AddRepoSheet } from './AddRepoSheet';
import { RepoProfileSheet } from './RepoProfileSheet';
import { WatchedRepoRow } from './WatchedRepoRow';

const COLUMNS = [
  { label: 'Repository' },
  { label: 'Status' },
  { label: 'Last checked' },
  { label: 'Brief' },
  { label: 'Watch' },
  { label: 'Actions', srOnly: true },
];

export function ReposManager() {
  // Refreshed now and then so "last checked" keeps up with the poller running in the background.
  const repos = useListRepos({ query: { refetchInterval: 15_000 } });
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [profileOf, setProfileOf] = useState<ListReposResponseDtoReposItem | null>(null);
  // The profile of every repository, looked at often while one is being built and now and then otherwise.
  const profiles = useListProfiles({
    query: { refetchInterval: (query) => (query.state.data?.profiles.some((p) => p.status === 'building') ? 3_000 : 20_000) },
  });
  const profileStatus = new Map(profiles.data?.profiles.map((p) => [p.repositoryId, p.status]));

  const list = repos.data?.repos ?? [];
  const loaded = repos.data !== undefined;
  const text = search.trim().toLowerCase();
  const shown = list.filter((repo) => repo.fullName.toLowerCase().includes(text));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search"
            aria-label="Search repositories"
            className="h-10 pl-9"
          />
        </div>
        <Button className="ml-auto h-10 px-4" onClick={() => setAdding(true)}>
          <Plus aria-hidden />
          Add repository
        </Button>
      </div>

      <div className="space-y-4">
        {repos.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        {repos.isError && <p className="text-sm text-destructive">{repos.error.message}</p>}

        {loaded && list.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-12 text-center">
            <span className="rounded-full bg-secondary p-3 text-muted-foreground">
              <FolderPlus className="size-6" aria-hidden />
            </span>
            <div>
              <p className="font-medium">You are not watching any repository yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Give the diffy GitHub App a repository and it shows up here by itself, then its new pull requests are reviewed. Pull
                requests that are already open stay as they are. You can also add one yourself.
              </p>
            </div>
            <Button onClick={() => setAdding(true)}>
              <Plus aria-hidden />
              Add your first repository
            </Button>
          </div>
        )}

        {loaded && list.length > 0 && shown.length === 0 && (
          <p className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">No repository matches your search.</p>
        )}

        {shown.length > 0 && (
          <DataTable columns={COLUMNS}>
            {shown.map((repo) => (
              <WatchedRepoRow key={repo.id} repo={repo} profileStatus={profileStatus.get(repo.id)} onOpenProfile={() => setProfileOf(repo)} />
            ))}
          </DataTable>
        )}
      </div>

      <AddRepoSheet open={adding} onOpenChange={setAdding} />
      <RepoProfileSheet repo={profileOf} onClose={() => setProfileOf(null)} />
    </div>
  );
}
