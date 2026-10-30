'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { getGetMeQueryKey, useGetSettings, useLogout } from '@/api/generated/diffy';
import { Button } from '@/components/ui/button';

// What a person sees who is signed in but cannot use diffy for any account yet: the App is not installed on anything
// they can reach. They install it on GitHub and come back; the page checks by itself (AuthGate asks every few seconds).
export function NoAccountScreen({ login }: { login: string }) {
  const queryClient = useQueryClient();
  const settings = useGetSettings();
  const logout = useLogout({
    mutation: {
      onSuccess: async () => {
        queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== getGetMeQueryKey()[0] });
        await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      },
    },
  });
  const installUrl = settings.data?.github.installUrl;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-3">
          <h1 className="pb-2 font-brand text-4xl font-normal lowercase leading-tight [-webkit-text-stroke:0.5px]">diffy</h1>
          <p className="text-sm text-muted-foreground">
            Hi <strong className="text-foreground">{login}</strong>. diffy is not installed on any account you can use yet.
          </p>
        </div>

        <div className="space-y-3">
          {installUrl ? (
            <Button asChild className="h-10 w-full">
              <a href={installUrl} target="_blank" rel="noreferrer">
                Install diffy on GitHub
                <ExternalLink className="size-4" aria-hidden />
              </a>
            </Button>
          ) : (
            <p role="alert" className="text-sm text-destructive">
              {settings.isError ? settings.error.message : 'Looking for the diffy GitHub App…'}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Choose your account or an organization and the repositories to review. This page continues by itself once it is installed.
          </p>
        </div>

        <Button variant="ghost" size="sm" onClick={() => logout.mutate()} disabled={logout.isPending}>
          Sign out
        </Button>
      </div>
    </main>
  );
}
