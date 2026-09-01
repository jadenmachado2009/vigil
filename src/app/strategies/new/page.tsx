import { PageHeader } from '@/components/app-shell';
import { NewStrategyFlow } from '@/features/strategies/new-strategy-flow';
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
      <NewStrategyFlow mode={mode} />
    </>
  );
}
