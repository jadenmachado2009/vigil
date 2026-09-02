import { PageHeader } from '@/components/app-shell';
import { AsOf } from '@/components/as-of';
import { AnalyzeTabs } from '@/features/analyze/analyze-tabs';

export default function AnalyzePage() {
  return (
    <>
      <PageHeader figure="Fig. 02 — Opportunity check" title="Analyze" asOf={<AsOf />} />
      <AnalyzeTabs />
    </>
  );
}
