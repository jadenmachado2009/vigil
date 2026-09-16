import type { ReactNode } from 'react';
import { CONTACT_EMAIL } from '@/lib/legal';

/** One numbered clause of a legal document. */
export function Clause({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-[44px_minmax(0,1fr)] gap-x-5 border-b border-hair py-6">
      <div className="num text-[15px] text-faint pt-1">{String(n).padStart(2, '0')}</div>
      <div className="min-w-0">
        <h2 className="ser text-[24px] leading-tight">{title}</h2>
        <div className="text-muted text-[15px] leading-relaxed mt-2.5 max-w-[72ch] space-y-3">{children}</div>
      </div>
    </section>
  );
}

/** How to get in touch, or an honest note that it is not set yet. */
export function ContactLine() {
  if (!CONTACT_EMAIL) {
    return <p>A contact address for questions about this page has not been published yet.</p>;
  }
  return (
    <p>
      Questions about this page:{' '}
      <a href={`mailto:${CONTACT_EMAIL}`} className="text-ink underline underline-offset-4">{CONTACT_EMAIL}</a>.
    </p>
  );
}
