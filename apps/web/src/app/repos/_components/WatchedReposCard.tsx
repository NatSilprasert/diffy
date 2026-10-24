'use client';

import { useListRepos } from '@/api/generated/diffy';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { WatchedRepoRow } from './WatchedRepoRow';

export function WatchedReposCard() {
  // Refreshed now and then so "last checked" keeps up with the poller running in the background.
  const repos = useListRepos({ query: { refetchInterval: 15_000 } });
  const list = repos.data?.repos ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Watching</CardTitle>
        <CardDescription>diffy checks these for new pull requests. Removing one keeps its review history.</CardDescription>
      </CardHeader>
      <CardContent>
        {repos.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        {repos.isError && <p className="text-sm text-destructive">{repos.error.message}</p>}
        {repos.isSuccess && list.length === 0 && (
          <p className="text-sm text-muted-foreground">You are not watching any repository yet. Add one above.</p>
        )}
        {list.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Repository</TableHead>
                <TableHead>Watching</TableHead>
                <TableHead>Last checked</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((repo) => (
                <WatchedRepoRow key={repo.id} repo={repo} />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
