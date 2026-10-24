'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  getListReposQueryKey,
  usePollRepo,
  useRemoveRepo,
  useUpdateRepo,
} from '@/api/generated/diffy';
import type { ListReposResponseDtoReposItem } from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { TableCell, TableRow } from '@/components/ui/table';
import { timeAgo } from '@/lib/time';

export function WatchedRepoRow({ repo }: { repo: ListReposResponseDtoReposItem }) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: getListReposQueryKey() });
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const update = useUpdateRepo({ mutation: { onSuccess: refresh } });
  const remove = useRemoveRepo({ mutation: { onSuccess: refresh } });
  const poll = usePollRepo({ mutation: { onSuccess: refresh } });

  const busy = update.isPending || remove.isPending;
  const error = update.error ?? remove.error ?? poll.error;

  return (
    <TableRow className={repo.enabled ? undefined : 'text-muted-foreground'}>
      <TableCell className="align-top">
        <div className="flex items-center gap-2 font-medium">
          {repo.fullName}
          {!repo.enabled && <Badge variant="secondary">Paused</Badge>}
        </div>
        {repo.lastError && (
          <p className="mt-1 max-w-md break-words text-xs text-destructive" title={repo.lastError}>
            Last check failed: {repo.lastError}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {error.message}
          </p>
        )}
        {poll.data && !poll.isPending && (
          <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
            {poll.data.error
              ? 'The check failed.'
              : poll.data.queued > 0
                ? `Queued ${poll.data.queued} review${poll.data.queued === 1 ? '' : 's'}.`
                : 'Nothing new to review.'}
          </p>
        )}
      </TableCell>
      <TableCell className="align-top">
        <Switch
          aria-label={`Watch ${repo.fullName}`}
          checked={repo.enabled}
          disabled={busy}
          onCheckedChange={(enabled) => update.mutate({ id: repo.id, data: { enabled } })}
        />
      </TableCell>
      <TableCell className="align-top text-sm" title={repo.lastPolledAt ?? undefined}>
        {repo.lastPolledAt ? timeAgo(repo.lastPolledAt) : 'Not yet'}
      </TableCell>
      <TableCell className="align-top">
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy || poll.isPending}
            onClick={() => poll.mutate({ data: { repositoryId: repo.id } })}
          >
            {poll.isPending ? 'Checking…' : 'Check now'}
          </Button>
          {confirmingRemove ? (
            <>
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() => remove.mutate({ id: repo.id })}
              >
                {remove.isPending ? 'Removing…' : 'Confirm'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmingRemove(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmingRemove(true)}>
              Remove
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
