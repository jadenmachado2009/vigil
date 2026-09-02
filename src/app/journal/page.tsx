import { PageHeader } from '@/components/app-shell';
import { Journal } from '@/features/journal/journal';

export default function JournalPage() {
  return (
    <>
      <PageHeader figure="Fig. 04 — Opportunity journal" title="Journal" />
      <Journal />
    </>
  );
}
