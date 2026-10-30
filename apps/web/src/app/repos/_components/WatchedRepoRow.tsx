'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { getListReposQueryKey, useRemoveRepo, useUpdateRepo } from '@/api/generated/diffy';
import type { GetProfileResponseDtoStatus, ListReposResponseDtoReposItem } from '@/api/generated/model';
import { ProfileStatusBadge } from '@/components/ProfileStatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const CELL = 'px-4 py-3.5 align-top';

// A click on the row opens the brief. The switch and the buttons stop that click, and the chevron at the end is a
// real button, so the keyboard can reach the same place.
const stop = (event: React.SyntheticEvent) => event.stopPropagation();

export function WatchedRepoRow({
  repo,
  profileStatus,
  onOpenProfile,
}: {
  repo: ListReposResponseDtoReposItem;
  profileStatus: GetProfileResponseDtoStatus | undefined;
  onOpenProfile: () => void;
}) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: getListReposQueryKey() });
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const update = useUpdateRepo({ mutation: { onSuccess: refresh } });
  const remove = useRemoveRepo({ mutation: { onSuccess: refresh } });

  const busy = update.isPending || remove.isPending;
  const error = update.error;
  const [owner, name] = repo.fullName.split('/');

  return (
    <TableRow className="cursor-pointer border-border bg-card hover:bg-secondary/60" onClick={onOpenProfile}>
      <TableCell className={CELL}>
        <div className={cn('text-sm font-medium', !repo.enabled && 'text-muted-foreground')}>
          <span className="font-normal text-muted-foreground">{owner}/</span>
          {name}
        </div>
        {error && (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {error.message}
          </p>
        )}
      </TableCell>
      <TableCell className={CELL}>
        {repo.enabled ? <Badge className="bg-success/15 text-success">Watching</Badge> : <Badge variant="secondary">Paused</Badge>}
      </TableCell>
      <TableCell className={CELL}>
        <ProfileStatusBadge status={profileStatus} />
      </TableCell>
      <TableCell className={CELL} onClick={stop}>
        <Switch
          aria-label={`Watch ${repo.fullName}`}
          checked={repo.enabled}
          disabled={busy}
          onCheckedChange={(enabled) => update.mutate({ id: repo.id, data: { enabled } })}
        />
      </TableCell>
      <TableCell className="px-4 py-3 align-top" onClick={stop}>
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" className="bg-destructive text-white hover:bg-destructive/90" disabled={busy} onClick={() => setConfirmingRemove(true)}>
            Remove
          </Button>
          <button
            type="button"
            onClick={onOpenProfile}
            aria-label={`Open the project brief of ${repo.fullName}`}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
        {/* Inside the cell that stops clicks: events in a dialog travel up the React tree, through the row. */}
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
      </TableCell>
    </TableRow>
  );
}
