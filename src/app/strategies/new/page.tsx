import { PageHeader } from '@/components/app-shell';
import { StrategyBuilder } from '@/features/strategies/strategy-builder';
import type { Mode } from '@/types/rules';

export default async function NewStrategyPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode: raw } = await searchParams;
  const mode: Mode = raw === 'investing' ? 'investing' : 'trading';
  return (
    <>
      <PageHeader title={mode === 'trading' ? 'New trading strategy' : 'New investment strategy'} />
      <StrategyBuilder initial={{ name: '', description: '', mode, meta: {}, rules: [] }} />
    </>
  );
}
