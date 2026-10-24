'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getGetSettingsQueryKey, useGetSettings, useUpdateGithubSettings } from '@/api/generated/diffy';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function GithubSettingsCard() {
  const queryClient = useQueryClient();
  const settings = useGetSettings();
  const [token, setToken] = useState('');
  const [replacing, setReplacing] = useState(false);

  const update = useUpdateGithubSettings({
    mutation: {
      onSuccess: async () => {
        // The token is cleared from the page as soon as it is saved; it is never shown again.
        setToken('');
        setReplacing(false);
        await queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      },
    },
  });

  const github = settings.data?.github;
  const showForm = settings.isSuccess && (!github?.configured || replacing);

  return (
    <Card>
      <CardHeader>
        <CardTitle>GitHub</CardTitle>
        <CardDescription>A personal access token lets diffy read pull requests and post reviews.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {settings.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        {settings.isError && <p className="text-sm text-destructive">{settings.error.message}</p>}

        {github?.configured && !replacing && (
          <div className="flex items-center gap-3">
            <Badge className="bg-success/15 text-success">Connected</Badge>
            <span className="text-sm">
              as <strong>@{github.login}</strong>
            </span>
            <Button variant="outline" size="sm" onClick={() => setReplacing(true)}>
              Replace token
            </Button>
          </div>
        )}

        {showForm && (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              update.mutate({ data: { token } });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="github-token">Personal access token</Label>
              <Input
                id="github-token"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="github_pat_…"
                value={token}
                onChange={(event) => setToken(event.target.value)}
              />
            </div>
            {update.isError && (
              <p role="alert" className="text-sm text-destructive">
                {update.error.message}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={!token.trim() || update.isPending}>
                {update.isPending ? 'Checking with GitHub…' : github?.configured ? 'Replace token' : 'Connect'}
              </Button>
              {replacing && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setReplacing(false);
                    setToken('');
                    update.reset();
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
            <details className="text-sm text-muted-foreground">
              <summary className="cursor-pointer">Which token do I need?</summary>
              <div className="mt-2 space-y-1">
                <p>
                  Create one at{' '}
                  <a
                    className="underline"
                    href="https://github.com/settings/personal-access-tokens/new"
                    target="_blank"
                    rel="noreferrer"
                  >
                    github.com/settings/personal-access-tokens/new
                  </a>
                  .
                </p>
                <p>
                  Fine-grained token: pick the repositories you want reviewed, then give it <em>Pull requests</em>{' '}
                  (read and write), <em>Contents</em> (read) and <em>Metadata</em> (read).
                </p>
                <p>A classic token needs the <code>repo</code> scope. Reviews are posted under the token&apos;s account.</p>
              </div>
            </details>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
