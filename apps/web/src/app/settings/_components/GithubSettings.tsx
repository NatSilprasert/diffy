'use client';

import { CheckCircle2, ExternalLink } from 'lucide-react';
import { useGetSettings } from '@/api/generated/diffy';
import { SettingsSection } from '@/components/SettingsSection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function GithubSettings() {
  const settings = useGetSettings();
  const github = settings.data?.github;

  const installButton = (label: string, variant: 'default' | 'outline') =>
    github?.installUrl ? (
      <Button asChild variant={variant} size="sm">
        <a href={github.installUrl} target="_blank" rel="noreferrer">
          {label}
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </Button>
    ) : null;

  return (
    <SettingsSection
      title="GitHub"
      description="Install the diffy GitHub App on your account or organization and choose the repositories. Reviews are posted by the app, not by you."
      badge={github?.configured ? <Badge className="bg-success/15 text-success">Connected</Badge> : undefined}
    >
      <div className="space-y-4">
        {settings.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        {settings.isError && <p className="text-sm text-destructive">{settings.error.message}</p>}

        {github?.configured && (
          <>
            <ul className="space-y-2.5">
              {github.accounts.map((account) => (
                <li key={account.login} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-5 text-success" aria-hidden />
                    <span>
                      Installed on <strong>{account.login}</strong>
                      <span className="text-muted-foreground"> ({account.type === 'Organization' ? 'organization' : 'personal'})</span>
                    </span>
                  </span>
                  <Badge variant="secondary">{account.repositorySelection === 'all' ? 'All repositories' : 'Selected repositories'}</Badge>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              {installButton('Add an account or repositories', 'outline')}
              {github.appName && (
                <span className="text-sm text-muted-foreground">
                  Reviews appear as <strong>{github.appName}[bot]</strong>.
                </span>
              )}
            </div>
          </>
        )}

        {settings.isSuccess && !github?.configured && (
          <div className="space-y-3 text-sm">
            {github?.installUrl ? (
              <>
                <p className="text-muted-foreground">diffy is not installed on any account yet. After you install it, come back to this page.</p>
                {installButton('Install the GitHub App', 'default')}
              </>
            ) : (
              <p role="alert" className="text-destructive">
                diffy could not reach GitHub to find its App. Check <code>GITHUB_APP_ID</code> and <code>GITHUB_APP_PRIVATE_KEY_PATH</code> in the
                server&apos;s <code>.env</code>.
              </p>
            )}
          </div>
        )}
      </div>
    </SettingsSection>
  );
}
