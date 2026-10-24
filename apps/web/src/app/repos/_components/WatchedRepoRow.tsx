'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getListReposQueryKey, usePollRepo, useRemoveRepo, useUpdateRepo } from '@/api/generated/diffy';
import type { ListReposResponseDtoReposItem } from '@/api/generated/model';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { TableCell, TableRow } from '@/components/ui/table';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';

const CELL = 'px-4 py-3.5 align-top';

export function WatchedRepoRow({ repo }: { repo: ListReposResponseDtoReposItem }) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: getListReposQueryKey() });
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const update = useUpdateRepo({ mutation: { onSuccess: refresh } });
  const remove = useRemoveRepo({ mutation: { onSuccess: refresh } });
  const poll = usePollRepo({ mutation: { onSuccess: refresh } });

  const busy = update.isPending || remove.isPending;
  const error = update.error ?? poll.error;
  const [owner, name] = repo.fullName.split('/');

  return (
    <TableRow className="border-border bg-card hover:bg-secondary/60">
      <TableCell className={CELL}>
        <div className={cn('text-sm font-medium', !repo.enabled && 'text-muted-foreground')}>
          <span className="font-normal text-muted-foreground">{owner}/</span>
          {name}
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
      <TableCell className={CELL}>
        {!repo.enabled ? (
          <Badge variant="secondary">Paused</Badge>
        ) : repo.lastError ? (
          <Badge variant="destructive">Check failed</Badge>
        ) : (
          <Badge className="bg-success/15 text-success">Watching</Badge>
        )}
      </TableCell>
      <TableCell className={cn(CELL, 'text-sm text-muted-foreground')} title={repo.lastPolledAt ?? undefined}>
        {repo.lastPolledAt ? timeAgo(repo.lastPolledAt) : 'Not yet'}
      </TableCell>
      <TableCell className={CELL}>
        <Switch
          aria-label={`Watch ${repo.fullName}`}
          checked={repo.enabled}
          disabled={busy}
          onCheckedChange={(enabled) => update.mutate({ id: repo.id, data: { enabled } })}
        />
      </TableCell>
      <TableCell className="px-4 py-3 align-top">
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy || poll.isPending}
            onClick={() => poll.mutate({ data: { repositoryId: repo.id } })}
          >
            {poll.isPending ? 'Checking…' : 'Check now'}
          </Button>
          <Button size="sm" className="bg-destructive text-white hover:bg-destructive/90" disabled={busy} onClick={() => setConfirmingRemove(true)}>
            Remove
          </Button>
        </div>
      </TableCell>
      <ConfirmDialog
        open={confirmingRemove}
        onOpenChange={(open) => {
          setConfirmingRemove(open);
          if (!open) remove.reset();
        }}
        title={`Remove ${repo.fullName}?`}
        description="diffy stops watching this repository and no longer reviews its pull requests. The reviews it already made stay in your history."
        confirmLabel="Remove"
        pending={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => remove.mutate({ id: repo.id })}
      />
    </TableRow>
  );
}
