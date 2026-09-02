import { PageHeader } from '@/components/app-shell';
import { AsOf } from '@/components/as-of';
import { AnalyzeTabs } from '@/features/analyze/analyze-tabs';

export default function AnalyzePage() {
  return (
    <>
      <PageHeader figure="Fig. 03 — Opportunity analysis" title="Analyze an opportunity." asOf={<AsOf />} />
      <AnalyzeTabs />
    </>
  );
}
