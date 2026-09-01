'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, type ReactNode } from 'react';
import { AccountBadge } from '@/features/auth/account-badge';
import { CommandPalette, useGoToShortcuts, type Command } from './command-palette';

/** Text labels, not decorative glyphs. The shortcut is part of the label. */
const NAV = [
  { href: '/', label: 'Dashboard', key: 'd' },
  { href: '/strategies', label: 'Strategies', key: 's' },
  { href: '/analyze', label: 'Analyze', key: 'a' },
  { href: '/journal', label: 'Journal', key: 'j' },
  { href: '/analytics', label: 'Analytics', key: 'n' },
];

const GOTO = Object.fromEntries(NAV.map((item) => [item.key, item.href]));

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  useGoToShortcuts(GOTO);

  const commands = useMemo<Command[]>(() => [
    ...NAV.map((item) => ({
      id: `go-${item.href}`,
      group: 'Go to',
      label: item.label,
      hint: `g ${item.key}`,
      run: () => router.push(item.href),
    })),
    { id: 'new-trading', group: 'Create', label: 'New trading strategy', run: () => router.push('/strategies/new?mode=trading') },
    { id: 'new-investing', group: 'Create', label: 'New investment strategy', run: () => router.push('/strategies/new?mode=investing') },
    { id: 'check-chart', group: 'Check', label: 'Check a chart setup', run: () => router.push('/analyze?mode=trading') },
    { id: 'check-company', group: 'Check', label: 'Check a company', run: () => router.push('/analyze?mode=investing') },
    { id: 'account', group: 'Account', label: 'Sign in or create an account', run: () => router.push('/sign-in') },
  ], [router]);

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 w-[188px] border-r border-line bg-surface flex flex-col z-10">
        <div className="h-[42px] flex items-center px-4 border-b border-line">
          <span className="font-semibold tracking-[-0.01em]">StrategyAI</span>
        </div>

        <nav className="py-2">
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-4 py-[7px] border-l-2 ${
                  active
                    ? 'border-ink text-ink bg-surface-2'
                    : 'border-transparent text-muted hover:text-ink hover:bg-surface-2'
                }`}
              >
                <span>{item.label}</span>
                <span className="num text-[10px] text-dim">g&nbsp;{item.key}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-line px-4 py-3">
          <AccountBadge />
        </div>
        <div className="border-t border-line px-4 py-2.5 text-[11px] text-dim leading-snug">
          Decision support. Not financial advice.
        </div>
      </aside>

      <div className="flex-1 ml-[188px] min-w-0">
        <header className="h-[42px] border-b border-line flex items-center justify-between px-5 sticky top-0 bg-bg/95 backdrop-blur z-[5]">
          <Breadcrumb pathname={pathname} />
          <button
            type="button"
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown'))}
            className="flex items-center gap-2 text-faint hover:text-muted cursor-default"
            aria-hidden
          >
            <span className="text-[11px]">Search</span>
            <span className="kbd">⌘K</span>
          </button>
        </header>
        <main className="p-5 max-w-[1500px]">{children}</main>
      </div>

      <CommandPalette commands={commands} />
    </div>
  );
}

const SEGMENT_LABELS: Record<string, string> = {
  strategies: 'Strategies',
  analyze: 'Analyze',
  journal: 'Journal',
  analytics: 'Analytics',
  new: 'New',
  'sign-in': 'Sign in',
  'sign-up': 'Sign up',
};

function Breadcrumb({ pathname }: { pathname: string }) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return <span className="text-muted">Dashboard</span>;
  return (
    <div className="flex items-center gap-2 text-muted min-w-0">
      {segments.map((segment, index) => (
        <span key={index} className="flex items-center gap-2 min-w-0">
          {index > 0 && <span className="text-dim">/</span>}
          <span className={`truncate ${index === segments.length - 1 ? 'text-ink' : ''}`}>
            {SEGMENT_LABELS[segment] ?? segment}
          </span>
        </span>
      ))}
    </div>
  );
}

/** Page title block. One line, no explanatory subtitle. */
export function PageHeader({
  title, meta, action,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-baseline justify-between gap-4 mb-5 flex-wrap">
      <div className="flex items-baseline gap-3 min-w-0">
        <h1 className="text-[19px] font-semibold tracking-[-0.015em]">{title}</h1>
        {meta && <span className="num text-[11px] text-dim">{meta}</span>}
      </div>
      {action}
    </header>
  );
}
