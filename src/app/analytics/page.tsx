import { PageHeader } from '@/components/app-shell';
import { Analytics } from '@/features/analytics/analytics';

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader figure="Fig. 05 — Performance" title="Analytics" />
      <Analytics />
    </>
  );
}
