import { PageHeader } from '@/components/app-shell';
import { AnalyzeTabs } from '@/features/analyze/analyze-tabs';

export default function AnalyzePage() {
  return (
    <>
      <PageHeader title="Analyze" />
      <AnalyzeTabs />
    </>
  );
}
