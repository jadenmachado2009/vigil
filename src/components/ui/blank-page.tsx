import type { ReactNode } from 'react';

export type Step = { title: string; body: string };

const pad = (n: number) => String(n).padStart(2, '0');

/** Three numbered steps across the column — how an empty page comes to hold something. */
export function Procedure({ steps, className = '' }: { steps: Step[]; className?: string }) {
  return (
    <div className={className}>
      <div className="doc">Procedure</div>
      <ol className="border-t border-ink mt-2 grid md:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="border-b border-hair md:border-b-0 md:border-r md:last:border-r-0 py-5 md:px-5 md:first:pl-0"
          >
            <div className="doc">{pad(index + 1)}</div>
            <div className="ser text-[19px] leading-tight mt-2">{step.title}</div>
            <p className="text-muted text-[12.5px] leading-relaxed mt-2">{step.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function AsideSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <div className="doc">{label}</div>
      <div className="border-t border-ink mt-2 pt-3">{children}</div>
    </section>
  );
}

/** Label → explanation pairs for the information column. */
export function AsideList({ items }: { items: { term: string; detail: string }[] }) {
  return (
    <dl className="-mt-3">
      {items.map((item) => (
        <div key={item.term} className="border-b border-hair py-2.5">
          <dt className="cap !text-ink">{item.term}</dt>
          <dd className="text-muted text-[12px] leading-relaxed mt-1">{item.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A faded sample of the populated page. Always labelled as illustrative, so it
 * can never be read as the user's own record.
 */
export function SpecimenTable({ columns, rows, template, minWidth = 620 }: {
  columns: ReactNode[];
  rows: ReactNode[][];
  /** A literal grid-cols-[…] class, so Tailwind can see it. */
  template: string;
  minWidth?: number;
}) {
  return (
    <div className="border-t border-ink overflow-x-auto">
      <div style={{ minWidth }}>
        <div className={`row row-head ${template}`}>
          {columns.map((c, i) => <div key={i}>{c}</div>)}
        </div>
        {rows.map((cells, r) => (
          <div key={r} className={`row ${template}`}>
            {cells.map((c, i) => <div key={i} className="min-w-0">{c}</div>)}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The empty version of a page. The same 65/35 structure as the populated one:
 * the finding and next action, how the page fills in, and what it will look
 * like — with an information column instead of bare margin.
 */
export function BlankPage({ headline, lede, actions, steps, after, specimen, aside }: {
  headline: ReactNode;
  lede: ReactNode;
  actions?: ReactNode;
  steps: Step[];
  after?: ReactNode;
  specimen?: { title: string; body: ReactNode };
  aside: ReactNode;
}) {
  return (
    <div className="grid lg:grid-cols-[65fr_35fr] gap-x-16 gap-y-12 items-start">
      <div className="min-w-0">
        <div className="ser text-[40px] leading-[1.08] font-light max-w-[20ch]">{headline}</div>
        <p className="text-muted leading-relaxed mt-5 max-w-[58ch]">{lede}</p>
        {actions && <div className="flex flex-wrap gap-3 mt-7">{actions}</div>}

        <Procedure steps={steps} className="mt-12" />

        {after}

        {specimen && (
          <div className="mt-12">
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <div className="doc">Specimen — {specimen.title}</div>
              <div className="doc">Illustrative · not your data</div>
            </div>
            <div className="mt-2 opacity-50 select-none pointer-events-none" aria-hidden="true">
              {specimen.body}
            </div>
          </div>
        )}
      </div>

      <aside className="flex flex-col gap-9">{aside}</aside>
    </div>
  );
}
