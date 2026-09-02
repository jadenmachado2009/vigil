import { PageHeader } from '@/components/app-shell';
import { DashboardOverview } from '@/features/strategies/dashboard-overview';
import { AsOf } from '@/components/as-of';

export default function DashboardPage() {
  return (
    <>
      <PageHeader figure="Fig. 00 — Instrument overview" title="Dashboard" asOf={<AsOf />} />
      <DashboardOverview />
    </>
  );
}
