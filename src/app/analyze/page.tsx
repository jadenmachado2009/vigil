import { PageHeader } from '@/components/app-shell';
import { Card } from '@/components/ui';

export default function AnalyzePage() {
  return (
    <>
      <PageHeader eyebrow="Coming next" title="Analyze" />
      <Card>
        <div className="text-muted text-center py-16 px-5 leading-relaxed max-w-[52ch] mx-auto">
          Not built yet. This screen arrives in a later phase, and will be wired to the same
          deterministic rules engine that powers every verdict.
        </div>
      </Card>
    </>
  );
}
