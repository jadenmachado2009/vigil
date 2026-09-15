import { PageHeader } from '@/components/app-shell';
import { AsOf } from '@/components/as-of';
import { PortfolioScreen } from '@/features/portfolio/portfolio';

export default function PortfolioPage() {
  return (
    <>
      <PageHeader figure="Fig. 08 — Portfolio limits" title="Portfolio" asOf={<AsOf />} />
      <PortfolioScreen />
    </>
  );
}
