'use client';

import { AlertCircle, X } from 'lucide-react';
import { useState } from 'react';
import { useGetStatus } from '@/api/generated/diffy';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';

// A notice at the top of the dashboard about what diffy is doing: tinted green when it waits, violet while it reviews,
// red when the server does not answer. It can be closed, but the closing is only remembered while the dashboard stays
// open: coming back to the page, or reloading it, shows the notice again.
export function LiveStatus() {
  const status = useGetStatus({ query: { refetchInterval: 5_000 } });
  const [closed, setClosed] = useState(false);
  const current = status.data?.queue.current ?? null;
  const reviewing = current !== null;
  const unreachable = status.isError;

  if (status.isPending || closed) return null;

  const queue = status.data?.queue;
  const poller = status.data?.poller;
  const tone = unreachable ? 'destructive' : reviewing ? 'primary' : 'success';

  return (
    <div
      role={unreachable ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm',
        tone === 'destructive' && 'border-destructive/40 bg-destructive/10',
        tone === 'primary' && 'border-primary/40 bg-primary/10',
        tone === 'success' && 'border-success/30 bg-success/10',
      )}
    >
      <span className="mt-1.5 flex size-2.5 shrink-0 items-center justify-center" aria-hidden>
        {unreachable ? (
          <AlertCircle className="size-4 text-destructive" />
        ) : (
          <span className={cn('size-2.5 rounded-full motion-reduce:animate-none', reviewing ? 'animate-pulse bg-primary' : 'bg-success')} />
        )}
      </span>

      <div className="min-w-0 flex-1 space-y-0.5">
        {unreachable ? (
          <>
            <p className="font-medium text-destructive">The diffy server is unreachable</p>
            <p className="text-muted-foreground">{status.error.message}</p>
          </>
        ) : (
          <>
            <p className="font-medium">
              {current ? (
                <>
                  Reviewing {current.repoFullName}#{current.prNumber}
                  <span className="font-normal text-muted-foreground"> · {current.prTitle}</span>
                </>
              ) : (
                'Idle · waiting for new pull requests'
              )}
            </p>
            <p className="text-muted-foreground">
              {queue!.waiting} waiting · last check{' '}
              {poller!.running ? 'in progress' : poller!.lastRunAt ? timeAgo(poller!.lastRunAt) : 'not yet'} · every {poller!.intervalSeconds} s
            </p>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => setClosed(true)}
        aria-label="Close"
        className="-mt-0.5 -mr-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
