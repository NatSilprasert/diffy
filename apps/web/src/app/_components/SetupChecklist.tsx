'use client';

import Link from 'next/link';
import { useGetSettings, useListRepos } from '@/api/generated/diffy';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function Step({ done, href, title, hint }: { done: boolean; href: string; title: string; hint: string }) {
  return (
    <li className="flex items-start gap-3">
      <span aria-hidden className={done ? 'text-emerald-500' : 'text-muted-foreground'}>
        {done ? '✓' : '○'}
      </span>
      <div>
        <Link href={href} className="text-sm font-medium underline-offset-2 hover:underline">
          {title}
        </Link>
        <span className="sr-only">{done ? ' (done)' : ' (to do)'}</span>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
    </li>
  );
}

// Shown only until the three things a review needs are in place. Renders nothing while loading or if it cannot tell.
export function SetupChecklist() {
  const settings = useGetSettings();
  const repos = useListRepos();
  if (!settings.data || !repos.data) return null;

  const github = settings.data.github.configured;
  const llm = settings.data.llm.configured;
  const watching = repos.data.repos.length > 0;
  if (github && llm && watching) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Finish setting up</CardTitle>
        <CardDescription>diffy needs these three things before it can review a pull request.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-4">
          <Step done={github} href="/settings/" title="Install the GitHub App" hint="Install diffy on your account and pick the repositories, so it can read pull requests and post reviews." />
          <Step done={llm} href="/settings/" title="Choose an AI model" hint="Pick a provider and model and save its API key." />
          <Step done={watching} href="/repos/" title="Watch a repository" hint="Add at least one repository. Its open pull requests are skipped; new ones get reviewed." />
        </ol>
      </CardContent>
    </Card>
  );
}
