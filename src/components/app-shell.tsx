'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const NAV = [
  { href: '/', label: 'Dashboard', glyph: '⌂' },
  { href: '/strategies', label: 'Strategies', glyph: '◈' },
  { href: '/analyze', label: 'Analyze', glyph: '◎' },
  { href: '/journal', label: 'Journal', glyph: '▤' },
  { href: '/analytics', label: 'Analytics', glyph: '◒' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 w-[68px] lg:w-[235px] border-r border-line bg-[rgba(7,9,12,.9)] px-3 lg:px-4 py-6 flex flex-col z-10">
        <div className="flex items-center gap-2.5 px-2 mb-6">
          <span className="w-2.5 h-2.5 rounded-full bg-accent shadow-[0_0_14px_var(--color-accent)] shrink-0" />
          <span className="font-black tracking-tight text-[16px] hidden lg:inline">StrategyAI</span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-3 rounded-[9px] transition flex items-center gap-2 ${
                  active ? 'bg-[#141a20] text-white shadow-[inset_2px_0_var(--color-accent)]' : 'text-[#89939f] hover:bg-[#141a20] hover:text-white'
                }`}
              >
                <span className="w-4 text-center shrink-0">{item.glyph}</span>
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto text-faint px-2 hidden lg:block">
          <div className="flex items-center gap-2 text-[12px]">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" /> Local data
          </div>
          <small className="block mt-2.5 leading-relaxed">
            Decision support only. Not financial advice.
          </small>
        </div>
      </aside>
      <main className="flex-1 ml-[68px] lg:ml-[235px] p-5 sm:p-7 lg:p-9 max-w-[1400px]">{children}</main>
    </div>
  );
}

export function PageHeader({ title, eyebrow, action }: { title: string; eyebrow: string; action?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-4 mb-7">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="text-[26px] sm:text-[30px] font-bold tracking-[-1px] mt-1.5">{title}</h1>
      </div>
      {action}
    </header>
  );
}
