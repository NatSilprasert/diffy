'use client';

import { useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { getGetMeQueryKey, useGetMe, useLogout, useSwitchAccount } from '@/api/generated/diffy';
import { Select } from '@/components/Select';
import { Button } from '@/components/ui/button';
import { LABEL } from '@/lib/sidebar';

// Who is signed in, which account they are looking at, and the way out. Sits at the bottom of the sidebar.
export function AccountMenu() {
  const queryClient = useQueryClient();
  const me = useGetMe();

  const switchAccount = useSwitchAccount({
    mutation: {
      onSuccess: async () => {
        // Everything on the screen belonged to the old account: forget it all and load again.
        await queryClient.resetQueries();
      },
    },
  });
  const logout = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.clear();
        // With nobody signed in, the gate shows the way in.
        void queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      },
    },
  });

  if (!me.data) return null;
  const { user, accounts, currentAccountId } = me.data;

  return (
    <div className="flex flex-col gap-2 border-t border-sidebar-border pt-3">
      {accounts.length > 1 && (
        <div className="collapsed:md:hidden">
          <Select
            label="Account"
            className="h-10 w-full"
            value={currentAccountId ?? undefined}
            onChange={(accountId) => switchAccount.mutate({ data: { accountId } })}
            options={accounts.map((account) => ({ value: account.id, label: account.login }))}
          />
        </div>
      )}
      <div className="flex items-center gap-3 px-1">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a static export has no image optimizer
          <img src={user.avatarUrl} alt="" className="size-8 shrink-0 rounded-full" />
        ) : (
          <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs uppercase">
            {user.login.slice(0, 2)}
          </span>
        )}
        <span className={`${LABEL} !ml-0 min-w-0 flex-1 truncate text-sm`} title={user.name ?? user.login}>
          {user.login}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground collapsed:md:hidden"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
