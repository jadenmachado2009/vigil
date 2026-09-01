'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { resetAccountState } from '@/lib/repository/client';

interface Me { signedIn: boolean; email: string | null; name: string | null }

/** Sidebar footer: says plainly where the user's data currently lives. */
export function AccountBadge() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    void fetch('/api/me')
      .then((r) => r.json() as Promise<Me>)
      .then(setMe)
      .catch(() => setMe({ signedIn: false, email: null, name: null }));
  }, []);

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
