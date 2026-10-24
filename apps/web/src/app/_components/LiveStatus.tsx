'use client';

import Link from 'next/link';
import { useGetStatus } from '@/api/generated/diffy';
import { StatTile } from '@/components/StatTile';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';

// A small light that says what diffy is doing: steady green when it is waiting, pulsing violet when it is reviewing.
function Light({ busy }: { busy: boolean }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-2.5 rounded-full', busy ? 'animate-pulse bg-primary' : 'bg-success', 'motion-reduce:animate-none')}
    />
  );
}

// What the server is doing right now, in the same four tiles as the usage totals below.
// When a refresh fails the last numbers stay, dimmed, instead of being wiped.
export function LiveStatus() {
  const status = useGetStatus({ query: { refetchInterval: 5_000 } });
  const queue = status.data?.queue;
  const poller = status.data?.poller;

  if (status.isPending) return null;
  if (!queue || !poller) {
    return (
      <p role="alert" className="text-sm text-destructive">
        The diffy server is unreachable: {status.error?.message}
      </p>
    );
  }

  const current = queue.current;
  const lastCheck = poller.running ? 'Checking…' : poller.lastRunAt ? timeAgo(poller.lastRunAt) : 'Not yet';

  return (
    <div className={cn('space-y-2', status.isError && 'opacity-50')}>
      {status.isError && (
        <p role="alert" className="text-sm text-destructive">
          The diffy server is unreachable. These numbers are the last ones it sent.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Right now"
          value={
            <span className="flex items-center gap-2.5">
              <Light busy={current !== null} />
              {current ? 'Reviewing' : 'Idle'}
            </span>
          }
          detail={current ? `${current.repoFullName}#${current.prNumber}` : 'Waiting for new pull requests'}
          title={current?.prTitle}
        />
        <StatTile label="In the queue" value={queue.waiting} detail={queue.waiting === 1 ? 'review waiting' : 'reviews waiting'} />
        <StatTile
          label="Last check"
          value={lastCheck}
          detail={poller.lastRunAt ? new Date(poller.lastRunAt).toLocaleTimeString() : 'The first one is on its way'}
        />
        <StatTile
          label="Checks every"
          value={`${poller.intervalSeconds} s`}
          detail={
            <Link href="/repos/" className="underline-offset-2 hover:underline">
              Manage repositories
            </Link>
          }
        />
      </div>
    </div>
  );
}
