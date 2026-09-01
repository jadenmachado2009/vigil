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
      <div className="flex border-b border-line mb-4 -mt-1">
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
            <span className="num text-[10px] ml-2 text-dim">{tab.hint}</span>
          </button>
        ))}
      </div>
      {mode === 'trading' ? <OpportunityChecker /> : <CompanyChecker />}
    </>
  );
}
