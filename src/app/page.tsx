import { PageHeader } from '@/components/app-shell';
import { DashboardOverview } from '@/features/strategies/dashboard-overview';

export default function DashboardPage() {
  return (
    <>
      <PageHeader figure="Fig. 00 — Instrument overview" title="Dashboard" />
      <DashboardOverview />
    </>
  );
}
