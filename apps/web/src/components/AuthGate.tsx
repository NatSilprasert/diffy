'use client';

import { useGetMe } from '@/api/generated/diffy';
import { ApiError } from '@/api/fetcher';
import { NoAccountScreen } from '@/components/NoAccountScreen';
import { SignInScreen } from '@/components/SignInScreen';
import { Button } from '@/components/ui/button';

const NO_ACCOUNT_RECHECK_MS = 3_000;

// Shows the app to a person who is signed in and the way in to everyone else.
export function AuthGate({ children }: { children: React.ReactNode }) {
  const me = useGetMe({
    query: {
      retry: false,
      // Someone who has no account yet is probably installing the App right now: look again every few seconds, so the
      // app opens as soon as GitHub has told diffy about the installation.
      refetchInterval: (query) => (query.state.data && query.state.data.currentAccountId === null ? NO_ACCOUNT_RECHECK_MS : false),
    },
  });

  if (me.isPending) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Loading…</div>;
  }
  if (me.isError) {
    // 401 only means "not signed in". Anything else (the server is down) is not something signing in fixes.
    if (me.error instanceof ApiError && me.error.status === 401) return <SignInScreen />;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p role="alert" className="text-sm text-destructive">
          {me.error.message}
        </p>
        <Button variant="outline" size="sm" onClick={() => void me.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  if (me.data.currentAccountId === null) return <NoAccountScreen login={me.data.user.login} />;
  return <>{children}</>;
}
