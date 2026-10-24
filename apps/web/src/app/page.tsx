'use client';

import { useGetStatus } from '@/api/generated/diffy';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// F2 only proves the wiring: the generated hook, the fetcher and the types. F7 builds the real dashboard.
export default function DashboardPage() {
  const status = useGetStatus({ query: { refetchInterval: 5_000 } });
  const queue = status.data?.queue;
  const poller = status.data?.poller;

  return (
    <>
      <PageHeader title="Dashboard" description="What Diffy is doing right now." />
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Server status</CardTitle>
            {status.isPending && <Badge variant="secondary">loading</Badge>}
            {status.isError && <Badge variant="destructive">unreachable</Badge>}
            {status.isSuccess && <Badge>live</Badge>}
          </div>
          <CardDescription>Refreshed every 5 seconds from GET /api/reviews/status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {status.isError && <p className="text-destructive">{status.error.message}</p>}
          {queue && poller && (
            <ul className="list-disc space-y-1 pl-5">
              <li>
                {queue.current
                  ? `Reviewing ${queue.current.repoFullName}#${queue.current.prNumber}: ${queue.current.prTitle}`
                  : 'No review running.'}{' '}
                {queue.waiting} waiting.
              </li>
              <li>
                Checks for new pull requests every {poller.intervalSeconds}s
                {poller.lastRunAt ? `, last at ${new Date(poller.lastRunAt).toLocaleTimeString()}` : ', not yet'}.
              </li>
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
