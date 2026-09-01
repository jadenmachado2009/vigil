'use client';

import { useState } from 'react';
import { OpportunityChecker } from './opportunity-checker';
import { CompanyChecker } from './company-checker';

type Mode = 'trading' | 'investing';

const TABS: { value: Mode; label: string; hint: string }[] = [
  { value: 'trading', label: 'Trading', hint: 'Chart setup' },
  { value: 'investing', label: 'Investing', hint: 'Company' },
];

export function AnalyzeTabs() {
  const [mode, setMode] = useState<Mode>('trading');
  return (
    <>
      <div className="flex border-b border-line mb-6 -mt-1">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setMode(tab.value)}
            className={`px-4 py-3 cursor-pointer border-b-2 -mb-px transition ${
              mode === tab.value
                ? 'border-accent text-ink'
                : 'border-transparent text-faint hover:text-muted'
            }`}
          >
            <span className="font-bold">{tab.label}</span>
            <span className="text-[11px] uppercase tracking-wider ml-2 text-faint">{tab.hint}</span>
          </button>
        ))}
      </div>
      {mode === 'trading' ? <OpportunityChecker /> : <CompanyChecker />}
    </>
  );
}
