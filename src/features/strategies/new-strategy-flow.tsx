'use client';

import { useState } from 'react';
import type { Mode, Rule, StrategyMeta } from '@/types/rules';
import { DescribeStrategy } from './describe-strategy';
import { StrategyBuilder, type BuilderInitial } from './strategy-builder';

/**
 * Two ways in. Describing it is the default because writing rules by hand is
 * the boring part; the builder is always one click away, and every parsed rule
 * lands there for review before anything is saved.
 */
export function NewStrategyFlow({ mode }: { mode: Mode }) {
  const [initial, setInitial] = useState<BuilderInitial | null>(null);

  if (initial) return <StrategyBuilder initial={initial} />;

  return (
    <DescribeStrategy
      mode={mode}
      onSkip={() => setInitial({ name: '', description: '', mode, meta: {}, rules: [] })}
      onReady={({ rules, name, description, meta }: {
        rules: Rule[]; name: string; description: string; meta: StrategyMeta;
      }) => setInitial({ name, description, mode, meta, rules })}
    />
  );
}
