import { PageHeader } from '@/components/app-shell';
import { DashboardOverview } from '@/features/strategies/dashboard-overview';

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" />
      <DashboardOverview />
    </>
  );
}
