'use client';

import Link from 'next/link';
import { useGetStatus } from '@/api/generated/diffy';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { timeAgo } from '@/lib/time';

// What the server is doing right now. On a failed refresh the last numbers stay, dimmed and labelled, not wiped.
export function LiveStatus() {
  const status = useGetStatus({ query: { refetchInterval: 5_000 } });
  const queue = status.data?.queue;
  const poller = status.data?.poller;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Right now</CardTitle>
          {status.isPending && <Badge variant="secondary">Loading</Badge>}
          {status.isError && <Badge variant="destructive">Server unreachable</Badge>}
        </div>
      </CardHeader>
      <CardContent className={status.isError ? 'space-y-2 text-sm opacity-50' : 'space-y-2 text-sm'}>
        {status.isError && !status.data && <p className="text-destructive">{status.error.message}</p>}
        {queue && poller && (
          <>
            <p>
              {queue.current ? (
                <>
                  Reviewing{' '}
                  <span className="font-medium">
                    {queue.current.repoFullName}#{queue.current.prNumber}
                  </span>
                  : {queue.current.prTitle}
                </>
              ) : (
                'No review is running.'
              )}{' '}
              <span className="text-muted-foreground">{queue.waiting} waiting.</span>
            </p>
            <p className="text-muted-foreground">
              Looks for new pull requests every {poller.intervalSeconds} s.{' '}
              {poller.running
                ? 'Checking now.'
                : poller.lastRunAt
                  ? `Last check ${timeAgo(poller.lastRunAt)}.`
                  : 'Has not checked yet.'}{' '}
              Manage repositories on the{' '}
              <Link href="/repos/" className="underline">
                Repositories
              </Link>{' '}
              page.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
