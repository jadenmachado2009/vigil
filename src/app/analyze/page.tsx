import { PageHeader } from '@/components/app-shell';
import { OpportunityChecker } from '@/features/analyze/opportunity-checker';

export default function AnalyzePage() {
  return (
    <>
      <PageHeader eyebrow="Opportunity checker" title="Analyze" />
      <OpportunityChecker />
    </>
  );
}
