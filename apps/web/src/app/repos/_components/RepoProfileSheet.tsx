'use client';

import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '@/api/fetcher';
import {
  getGetProfileQueryKey,
  getListProfilesQueryKey,
  useGetProfile,
  useRebuildProfile,
  useUpdateProfileNotes,
} from '@/api/generated/diffy';
import type { ListReposResponseDtoReposItem } from '@/api/generated/model';
import { ProfileStatusBadge } from '@/components/ProfileStatusBadge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { formatTokens } from '@/lib/format';
import { timeAgo } from '@/lib/time';
import { ProfileMarkdown } from './ProfileMarkdown';

// Same as MAX_NOTES_CHARS on the server.
const MAX_NOTES_CHARS = 10_000;

// The project brief: what diffy has learned about one repository, the notes you add to it, and the button to learn it again.
// A panel on the right, like a review.
export function RepoProfileSheet({ repo, onClose }: { repo: ListReposResponseDtoReposItem | null; onClose: () => void }) {
  return (
    <Sheet open={repo !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-2xl" aria-describedby={undefined}>
        {repo && <ProfileBody repo={repo} />}
      </SheetContent>
    </Sheet>
  );
}

function ProfileBody({ repo }: { repo: ListReposResponseDtoReposItem }) {
  const queryClient = useQueryClient();
  const profile = useGetProfile(repo.id, {
    query: {
      // A repository without a brief is a 404, which is an answer, not something to try again.
      retry: false,
      refetchInterval: (query) => (query.state.data?.status === 'building' ? 3_000 : false),
    },
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey(repo.id) });
    await queryClient.invalidateQueries({ queryKey: getListProfilesQueryKey() });
  };
  const rebuild = useRebuildProfile({ mutation: { onSuccess: refresh } });

  const none = profile.error instanceof ApiError && profile.error.status === 404;
  const data = profile.data;
  const building = data?.status === 'building' || rebuild.isPending;

  const header = (
    <header className="space-y-3 border-b px-6 pt-5 pr-12 pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <ProfileStatusBadge status={data?.status} />
        {data?.builtAt && (
          <span className="text-xs text-muted-foreground" title={data.builtAt}>
            Built {timeAgo(data.builtAt)}
          </span>
        )}
      </div>
      <SheetTitle>
        <span className="font-normal text-muted-foreground">{repo.owner}/</span>
        {repo.name}
      </SheetTitle>
      <SheetDescription>What diffy learned by reading this repository. It is given to every review of it.</SheetDescription>

      {data?.model && (
        <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-background px-3 py-2 text-xs">
          <div className="flex items-center gap-1.5">
            <dt className="text-muted-foreground">Written by</dt>
            <dd className="font-medium">
              {data.provider ? `${data.provider} / ` : ''}
              {data.model}
            </dd>
          </div>
          {data.branch && data.builtCommit && (
            <div className="flex items-center gap-1.5">
              <dt className="text-muted-foreground">From</dt>
              <dd className="font-medium">
                {data.branch}@<code title={data.builtCommit}>{data.builtCommit.slice(0, 7)}</code>
              </dd>
            </div>
          )}
          {(data.inputTokens !== null || data.outputTokens !== null) && (
            <div className="flex items-center gap-1.5">
              <dt className="text-muted-foreground">Tokens</dt>
              <dd className="font-medium tabular-nums">
                {formatTokens(data.inputTokens ?? 0)} in · {formatTokens(data.outputTokens ?? 0)} out
              </dd>
            </div>
          )}
        </dl>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={building}
          onClick={() => rebuild.mutate({ repositoryId: repo.id })}
          title="Read the repository again and write a new brief. It uses your model, a few cents at most. Your notes are kept."
        >
          <RotateCw className={building ? 'animate-spin' : undefined} aria-hidden />
          {building ? 'Building…' : none ? 'Build the brief' : 'Rebuild'}
        </Button>
        {rebuild.isError && (
          <span role="alert" className="text-sm text-destructive">
            {rebuild.error.message}
          </span>
        )}
      </div>
    </header>
  );

  if (profile.isPending) {
    return (
      <>
        {header}
        <p className="p-6 text-sm text-muted-foreground">Loading…</p>
      </>
    );
  }
  if (profile.isError && !none) {
    return (
      <>
        {header}
        <p role="alert" className="p-6 text-sm text-destructive">
          {profile.error.message}
        </p>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="flex-1 space-y-8 overflow-y-auto px-6 py-5">
        {none && (
          <p className="text-sm text-muted-foreground">
            This repository has no brief yet. diffy builds one on its next check once GitHub and a model are set up in Settings, or you can build it now.
          </p>
        )}

        {data?.status === 'failed' && (
          <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            <div className="min-w-0">
              <p className="font-medium text-destructive">The last build failed</p>
              <p className="mt-0.5 break-words whitespace-pre-wrap text-foreground/90">{data.error ?? 'No reason was recorded.'}</p>
              {data.content && <p className="mt-1 text-muted-foreground">The brief below is the previous one, which reviews still use.</p>}
            </div>
          </div>
        )}

        {data?.status === 'building' && !data.content && (
          <p role="status" className="text-sm text-muted-foreground">
            diffy is reading the repository. This page updates by itself, usually in under a minute.
          </p>
        )}

        {data?.content && (
          <section aria-label="Project brief">
            <h2 className="mb-3 text-sm font-medium">Project brief</h2>
            <ProfileMarkdown text={data.content} />
            <p className="mt-4 text-xs text-muted-foreground">
              Written by a model from the files it read, so it can be wrong. Reviews treat it as background and trust your notes and the code in the pull request over it.
            </p>
          </section>
        )}

        {data && <NotesEditor repositoryId={repo.id} saved={data.notes} onSaved={refresh} />}
      </div>
    </>
  );
}

// Notes are yours: a rebuild never changes them, and every review of the repository gets them as instructions.
function NotesEditor({ repositoryId, saved, onSaved }: { repositoryId: string; saved: string; onSaved: () => Promise<void> }) {
  const [draft, setDraft] = useState(saved);
  const update = useUpdateProfileNotes({ mutation: { onSuccess: onSaved } });
  const dirty = draft.trim() !== saved.trim();

  return (
    <form
      aria-label="Notes"
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        update.mutate({ repositoryId, data: { notes: draft } });
      }}
    >
      <h2 className="text-sm font-medium">Your notes</h2>
      <p className="text-sm text-muted-foreground">
        Anything a reviewer of this repository should know that the code does not show: rules, decisions, what to ignore. Every review gets these as instructions from you, and a rebuild never changes them.
      </p>
      <Textarea
        aria-label="Notes for reviews of this repository"
        value={draft}
        maxLength={MAX_NOTES_CHARS}
        rows={7}
        placeholder="For example: money is stored in satang as an integer. Flag any raw SQL."
        onChange={(event) => setDraft(event.target.value)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={!dirty || update.isPending}>
          {update.isPending ? 'Saving…' : 'Save notes'}
        </Button>
        {dirty && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(saved)}>
            Discard changes
          </Button>
        )}
        {update.isSuccess && !dirty && <span className="text-sm text-muted-foreground">Saved</span>}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {draft.length.toLocaleString()} / {MAX_NOTES_CHARS.toLocaleString()}
        </span>
      </div>
      {update.isError && (
        <p role="alert" className="text-sm text-destructive">
          {update.error.message}
        </p>
      )}
    </form>
  );
}
