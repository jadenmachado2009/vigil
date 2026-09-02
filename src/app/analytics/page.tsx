import { PageHeader } from '@/components/app-shell';
import { AsOf } from '@/components/as-of';
import { Analytics } from '@/features/analytics/analytics';

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader figure="Fig. 06 — Performance" title="Analytics" asOf={<AsOf />} />
      <Analytics />
    </>
  );
}
