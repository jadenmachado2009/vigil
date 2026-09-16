'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, type ReactNode } from 'react';
import { AccountBadge } from '@/features/auth/account-badge';
import { ModeProvider, useMode } from '@/features/mode/mode-context';
import { CommandPalette, useGoToShortcuts, type Command } from './command-palette';

const NAV = [
  { href: '/', label: 'Dashboard', key: 'd', no: '01' },
  { href: '/strategies', label: 'Strategies', key: 's', no: '02' },
  { href: '/analyze', label: 'Analyze', key: 'a', no: '03' },
  { href: '/journal', label: 'Journal', key: 'j', no: '04' },
  { href: '/analytics', label: 'Analytics', key: 'n', no: '05' },
  { href: '/portfolio', label: 'Portfolio', key: 'p', no: '06' },
  { href: '/how-it-works', label: 'How it works', key: 'h', no: '07' },
];

const GOTO = Object.fromEntries(NAV.map((item) => [item.key, item.href]));

/**
 * The lockup. The V carries the identity, so it is given room and a rule at
 * cap height; the tagline sits under the wordmark, quieter than either.
 */
export function Wordmark() {
  return (
    <div className="flex items-center gap-5">
      <span className="ser text-[48px] leading-[0.7] font-light">V</span>
      <span className="w-px self-stretch bg-ink/70" />
      <span>
        <span className="wordmark block text-[19px] leading-none">VIGIL</span>
        <span className="doc block mt-2 !text-[8.5px] !tracking-[0.24em] text-faint">
          Watch the market. Protect your edge.
        </span>
      </span>
    </div>
  );
}

function ModeSwitch() {
  const { mode, setMode } = useMode();
  return (
    <div className="flex items-baseline gap-5">
      <span className="doc">Mode</span>
      {(['trading', 'investing'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setMode(option)}
          className={`cap cursor-pointer pb-1 border-b ${
            mode === option ? 'border-ink !text-ink' : 'border-transparent hover:!text-muted'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
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
    { id: 'check', group: 'Check', label: 'Analyze an opportunity', run: () => router.push('/analyze') },
    { id: 'account', group: 'Account', label: 'Sign in or create an account', run: () => router.push('/sign-in') },
  ], [router]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-ink px-4 sm:px-7 lg:px-10 py-4 flex items-start justify-between gap-x-8 gap-y-4 flex-wrap">
        <Link href="/"><Wordmark /></Link>
        <nav className="flex flex-wrap gap-x-6 sm:gap-x-8 gap-y-2 pt-1">
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className="flex items-baseline gap-2 group">
                <span className="doc">{item.no}</span>
                <span className={`cap pb-0.5 border-b ${
                  active ? 'border-ink !text-ink' : 'border-transparent group-hover:!text-muted'
                }`}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="border-b border-rule px-4 sm:px-7 lg:px-10 py-2.5 flex items-center justify-between gap-x-6 gap-y-2 flex-wrap">
        <ModeSwitch />
        <div className="flex items-center gap-5">
          <AccountBadge />
          <span className="kbd">⌘K</span>
        </div>
      </div>

      <main className="px-4 sm:px-7 lg:px-10 py-8 max-w-[1600px] w-full mx-auto">{children}</main>
      <footer className="border-t border-rule mt-auto px-4 sm:px-7 lg:px-10 py-5 flex items-baseline justify-between gap-x-8 gap-y-2 flex-wrap">
        <div className="doc">© 2026 Vigil · All rights reserved</div>
        <div className="doc !normal-case !tracking-normal text-muted">
          Not financial advice. A verdict describes your own rules, never what the market will do.
        </div>
        <div className="flex items-center gap-5">
          <Link href="/how-it-works" className="doc hover:!text-ink">How it works</Link>
          <Link href="/terms" className="doc hover:!text-ink">Terms</Link>
          <Link href="/privacy" className="doc hover:!text-ink">Privacy</Link>
        </div>
      </footer>
      <CommandPalette commands={commands} />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ModeProvider>
      <Shell>{children}</Shell>
    </ModeProvider>
  );
}

/** Page heading, framed as an exhibit in a document. */
export function PageHeader({
  title, figure, asOf, action,
}: {
  title: string;
  figure?: string;
  asOf?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-7">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        {figure && <div className="doc">{figure}</div>}
        {asOf && <div className="doc">{asOf}</div>}
      </div>
      <div className="flex items-baseline justify-between gap-4 flex-wrap mt-3">
        <h1 className="ser text-[40px] leading-none font-light">{title}</h1>
        {action}
      </div>
    </header>
  );
}
