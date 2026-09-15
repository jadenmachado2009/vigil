'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { getAccount, resetAccountState, type Account } from '@/lib/repository/client';

/**
 * Where the user's data currently lives. Deliberately quiet — it is a status
 * line on an instrument, not a prompt to sign up.
 */
export function AccountBadge() {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Account | null>(null);

  // The shell lives in the layout and does not remount on navigation, so this
  // re-reads on every route change. Signing in redirects, which is what makes
  // the badge notice.
  useEffect(() => { void getAccount().then(setMe); }, [pathname]);

  if (!me) return null;

  if (!me.signedIn) {
    return (
      <div className="doc flex items-center gap-3">
        <span className="hidden sm:inline">Local session</span>
        <span className="hidden sm:inline">·</span>
        <Link href="/sign-in" className="hover:text-ink">Sign in</Link>
        <Link href="/sign-up" className="border border-ink !text-ink px-2.5 py-1 hover:bg-paper-2">
          Create account
        </Link>
      </div>
    );
  }

  return (
    <div className="doc flex items-center gap-2">
      <span className="truncate max-w-[22ch]" title={me.email ?? ''}>{me.name || me.email}</span>
      <span>·</span>
      <button
        type="button"
        className="doc hover:text-ink cursor-pointer"
        onClick={async () => {
          await signOut({ redirect: false });
          resetAccountState();
          router.push('/');
          router.refresh();
        }}
      >
        Sign out
      </button>
    </div>
  );
}
