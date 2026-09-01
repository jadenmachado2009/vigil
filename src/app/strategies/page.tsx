import Link from 'next/link';
import { PageHeader } from '@/components/app-shell';
import { Button } from '@/components/ui';
import { StrategyLibrary } from '@/features/strategies/strategy-library';

export default function StrategiesPage() {
  return (
    <>
      <PageHeader title="Your strategies"
        action={
          <div className="flex gap-2">
            <Link href="/strategies/new?mode=trading"><Button variant="secondary">New trading</Button></Link>
            <Link href="/strategies/new?mode=investing"><Button>New investing</Button></Link>
          </div>
        }
      />
      <StrategyLibrary />
    </>
  );
}
