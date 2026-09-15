'use client';

import { useMode } from '@/features/mode/mode-context';
import { OpportunityChecker } from './opportunity-checker';
import { CompanyChecker } from './company-checker';

type Mode = 'trading' | 'investing';

const TABS: { value: Mode; label: string; hint: string }[] = [
  { value: 'trading', label: 'Trading', hint: 'Chart setup' },
  { value: 'investing', label: 'Investing', hint: 'Company' },
];

/** Reads the shell's mode switch, so the two never disagree. */
export function AnalyzeTabs() {
  const { mode, setMode } = useMode();
  return (
    <>
      <div className="flex border-b border-rule mb-4 -mt-1">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setMode(tab.value)}
            className={`px-3 py-2 cursor-pointer border-b-2 -mb-px ${
              mode === tab.value
                ? 'border-ink text-ink'
                : 'border-transparent text-faint hover:text-muted'
            }`}
          >
            {tab.label}
            <span className="num text-[11.5px] ml-2 text-dim">{tab.hint}</span>
          </button>
        ))}
      </div>
      {mode === 'trading' ? <OpportunityChecker /> : <CompanyChecker />}
    </>
  );
}
