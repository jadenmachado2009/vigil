import { PageHeader } from '@/components/app-shell';
import { EditStrategy } from '@/features/strategies/edit-strategy';

export default async function EditStrategyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <PageHeader eyebrow="Strategy builder" title="Edit strategy" />
      <EditStrategy id={id} />
    </>
  );
}
