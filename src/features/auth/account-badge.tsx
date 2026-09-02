'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { getAccount, resetAccountState, type Account } from '@/lib/repository/client';

/** Sidebar footer: says plainly where the user's data currently lives. */
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
      <div className="cap flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-dim" /> Held in this browser
        </div>
        <Link href="/sign-up" className="text-muted text-[12px] block mt-1.5 hover:text-ink">
          Create an account →
        </Link>
      </div>
    );
  }

  return (
    <div className="cap flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-pass" /> Saved to your account
      </div>
      <div className="text-[11px] mt-1.5 truncate" title={me.email ?? ''}>{me.name || me.email}</div>
      <button
        type="button"
        className="text-[12px] mt-2 hover:text-ink cursor-pointer"
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
