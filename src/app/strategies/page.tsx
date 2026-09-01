import Link from 'next/link';
import { PageHeader } from '@/components/app-shell';
import { Button } from '@/components/ui';
import { StrategyLibrary } from '@/features/strategies/strategy-library';

export default function StrategiesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Strategy library"
        title="Your strategies"
        action={
          <div className="flex gap-2">
            <Link href="/strategies/new?mode=trading"><Button variant="secondary">+ Trading</Button></Link>
            <Link href="/strategies/new?mode=investing"><Button>+ Investing</Button></Link>
          </div>
        }
      />
      <p className="text-muted mb-6 max-w-[70ch] leading-relaxed">
        The strategy is the source of truth. Data providers report what they observe; these rules
        decide the verdict.
      </p>
      <StrategyLibrary />
    </>
  );
}
