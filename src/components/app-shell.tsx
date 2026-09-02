'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, type ReactNode } from 'react';
import { AccountBadge } from '@/features/auth/account-badge';
import { CommandPalette, useGoToShortcuts, type Command } from './command-palette';

/** Numbered, horizontal. The section number is part of the label. */
const NAV = [
  { href: '/', label: 'Dashboard', key: 'd', no: '01' },
  { href: '/strategies', label: 'Strategies', key: 's', no: '02' },
  { href: '/analyze', label: 'Analyze', key: 'a', no: '03' },
  { href: '/journal', label: 'Journal', key: 'j', no: '04' },
  { href: '/analytics', label: 'Analytics', key: 'n', no: '05' },
];

const GOTO = Object.fromEntries(NAV.map((item) => [item.key, item.href]));

/** The lockup: monogram, a rule at cap height, wordmark and tagline. */
export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="ser text-[30px] leading-[0.78] font-medium">V</span>
      <span className="w-px h-[26px] bg-ink" />
      <span>
        <span className="wordmark block text-[15px] leading-none">VIGIL</span>
        {!compact && (
          <span className="cap block mt-1 text-[7.5px] tracking-[0.24em]">
            Watch the market. Protect your edge.
          </span>
        )}
      </span>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  useGoToShortcuts(GOTO);

  const commands = useMemo<Command[]>(() => [
    ...NAV.map((item) => ({
      id: `go-${item.href}`, group: 'Go to', label: item.label,
      hint: `g ${item.key}`, run: () => router.push(item.href),
    })),
    { id: 'new-trading', group: 'Create', label: 'New trading strategy', run: () => router.push('/strategies/new?mode=trading') },
    { id: 'new-investing', group: 'Create', label: 'New investment strategy', run: () => router.push('/strategies/new?mode=investing') },
    { id: 'check-chart', group: 'Check', label: 'Check a chart setup', run: () => router.push('/analyze') },
    { id: 'account', group: 'Account', label: 'Sign in or create an account', run: () => router.push('/sign-in') },
  ], [router]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-ink px-4 sm:px-6 py-3 flex items-center justify-between gap-x-6 gap-y-3 flex-wrap">
        <Link href="/"><Wordmark /></Link>
        <nav className="flex flex-wrap gap-x-5 sm:gap-x-7 gap-y-2">
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`pb-0.5 ${active ? 'border-b-2 border-ink' : 'border-b-2 border-transparent'}`}
              >
                <span className={`cap block text-[8px] ${active ? '!text-ink' : ''}`}>{item.no}</span>
                <span className="cap block mt-0.5 !text-ink">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="border-b border-rule px-4 sm:px-6 py-2 flex items-center justify-between gap-x-4 gap-y-2 flex-wrap">
        <AccountBadge />
        <div className="flex items-center gap-3">
          <span className="cap hidden sm:inline">Press G then a letter to move</span>
          <span className="kbd">⌘K</span>
        </div>
      </div>

      <main className="px-4 sm:px-6 py-6 sm:py-7 max-w-[1560px] w-full">{children}</main>
      <CommandPalette commands={commands} />
    </div>
  );
}

/**
 * Page heading. A figure caption sits above it — the screens are numbered
 * exhibits, which is what a compliance record is.
 */
export function PageHeader({
  title, figure, meta, action,
}: {
  title: string;
  figure?: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6">
      {figure && <div className="cap mb-4">{figure}</div>}
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div className="flex items-baseline gap-4 min-w-0">
          <h1 className="ser text-[30px] leading-none">{title}</h1>
          {meta && <span className="num text-[11px] text-dim">{meta}</span>}
        </div>
        {action}
      </div>
    </header>
  );
}
