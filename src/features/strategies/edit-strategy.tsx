'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { StrategyWithVersion } from '@/lib/repository/types';
import { strategyRepository } from '@/lib/repository/local';
import { Button, Card } from '@/components/ui';
import { StrategyBuilder } from './strategy-builder';

export function EditStrategy({ id }: { id: string }) {
  const [state, setState] = useState<{ loading: boolean; found: StrategyWithVersion | null }>({
    loading: true, found: null,
  });

  useEffect(() => {
    void strategyRepository.get(id).then((found) => setState({ loading: false, found }));
  }, [id]);

  if (state.loading) return <Card><div className="text-muted py-12 text-center">Loading…</div></Card>;

  if (!state.found) {
    return (
      <Card>
        <div className="text-center py-14 px-5">
          <p className="text-muted">That strategy no longer exists.</p>
          <Link href="/strategies"><Button variant="secondary" className="mt-4">Back to library</Button></Link>
        </div>
      </Card>
    );
  }

  const { strategy, version } = state.found;
  return (
    <StrategyBuilder
      initial={{
        id: strategy.id,
        name: strategy.name,
        description: strategy.description ?? '',
        mode: strategy.mode,
        meta: version.meta ?? {},
        rules: version.rules,
      }}
    />
  );
}
