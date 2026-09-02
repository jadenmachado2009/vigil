import { PageHeader } from '@/components/app-shell';
import { AsOf } from '@/components/as-of';
import { Journal } from '@/features/journal/journal';

export default function JournalPage() {
  return (
    <>
      <PageHeader figure="Fig. 05 — Journal" title="Journal" asOf={<AsOf />} />
      <Journal />
    </>
  );
}
