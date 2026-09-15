import Link from 'next/link';
import { PageHeader } from '@/components/app-shell';
import { AsOf } from '@/components/as-of';
import { Button, VerdictPill } from '@/components/ui';
import { AsideSection, AsideList, SpecimenTable } from '@/components/ui/blank-page';

export const metadata = { title: 'How it works — Vigil' };

const STAGES = [
  {
    title: 'You write the rules.',
    body: (
      <>
        Describe your setup or investment criteria in plain words. Vigil turns them into precise rules —
        a threshold, a condition that must be present, a session, a sector — and <strong className="em">asks
        you about anything unclear</strong> instead of guessing. You mark which rules are required.
      </>
    ),
    example: '“London open only, sweep of the Asian low, at least 1:2.5 risk to reward” becomes three rules.',
  },
  {
    title: 'You bring an opportunity.',
    body: (
      <>
        For a trade, drop a chart screenshot or mark what you see yourself, and add your entry, stop and
        target. For an investment, search a ticker and its reported fundamentals are pulled in.
      </>
    ),
    example: 'A EUR/USD 15-minute chart, entry 1.0842, stop 1.0828, target 1.0881.',
  },
  {
    title: 'The AI reads. The code decides.',
    body: (
      <>
        AI is only used to <strong className="em">read</strong> — what is on a chart, what a sentence means.
        Every comparison against your rules is done in ordinary code, the same way every time. Figures
        like risk to reward are <strong className="em">calculated, never taken from the AI</strong>.
      </>
    ),
    example: 'Risk 14 pips, reward 39 pips — 2.8, against a required 2.5. Pass.',
  },
  {
    title: 'You get one of four verdicts.',
    body: (
      <>
        Each rule is marked pass, fail, pending or no data, and the verdict follows from those.
        Anything that <strong className="em">cannot be confirmed is never counted as a pass</strong>.
      </>
    ),
    example: 'Three rules pass, break of structure has not happened yet — Watch.',
  },
  {
    title: 'You record what happened.',
    body: (
      <>
        Every check is saved to the journal with the exact rule version it was judged against. Add the
        outcome, and Analytics shows how your trades did <strong className="em">when each rule held
        against when it did not</strong> — which rules actually earn their place.
      </>
    ),
    example: 'After 40 closed trades: trades with the sweep averaged +0.9R; without it, −0.2R.',
  },
];

const VERDICTS = [
  { verdict: 'REJECTED' as const, rule: 'A required rule was broken.', why: 'Checked first — one broken rule is enough.' },
  { verdict: 'INSUFFICIENT_DATA' as const, rule: 'A required rule could not be verified.', why: 'Missing information is never assumed to be fine.' },
  { verdict: 'WATCH' as const, rule: 'Nothing broken, something not confirmed yet.', why: 'For example, a candle that has not closed.' },
  { verdict: 'QUALIFIED' as const, rule: 'Every required rule passed.', why: 'Only possible when nothing above applies.' },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHeader figure="Fig. 09 — Method" title="How it works" asOf={<AsOf />} />

      <div className="grid lg:grid-cols-[65fr_35fr] gap-x-16 gap-y-12 items-start">
        <div className="min-w-0">
          <div className="ser text-[48px] leading-[1.08] font-light max-w-[20ch]">
            Your rules decide. <em className="em">Vigil only checks.</em>
          </div>
          <p className="text-muted leading-relaxed mt-5 max-w-[60ch]">
            Vigil does not tell you what to trade or buy. You write the framework you already follow, and
            every opportunity is <strong className="em">measured against it and nothing else</strong> — so
            you can see, before you act, whether it actually fits your own rules.
          </p>
          <div className="flex flex-wrap gap-3 mt-7">
            <Link href="/strategies/new?mode=trading"><Button>Write your first strategy →</Button></Link>
            <Link href="/analyze"><Button variant="secondary">Analyze opportunity</Button></Link>
          </div>

          {/* The five stages. */}
          <div className="doc mt-14">The procedure</div>
          <ol className="border-t border-ink mt-2">
            {STAGES.map((stage, index) => (
              <li
                key={stage.title}
                className="grid grid-cols-[44px_minmax(0,1fr)] md:grid-cols-[56px_minmax(0,1fr)_minmax(0,300px)] gap-x-6 gap-y-3 border-b border-hair py-7"
              >
                <div className="num text-[15px] text-faint pt-1.5">{String(index + 1).padStart(2, '0')}</div>
                <div>
                  <div className="ser text-[28px] leading-tight">{stage.title}</div>
                  <p className="text-muted text-[15px] leading-relaxed mt-2.5 max-w-[56ch]">{stage.body}</p>
                </div>
                <div className="col-start-2 md:col-start-3 md:border-l md:border-rule md:pl-5 md:pt-1.5">
                  <div className="doc">In practice</div>
                  <p className="text-ink-2 text-[14px] leading-relaxed mt-1.5">{stage.example}</p>
                </div>
              </li>
            ))}
          </ol>

          {/* A report, so the stages have something concrete to point at. */}
          <div className="mt-14">
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <div className="doc">Specimen — one check, rule by rule</div>
              <div className="doc">Illustrative · not your data</div>
            </div>
            <div className="mt-2">
              <SpecimenTable
                template="grid-cols-[34px_minmax(0,1fr)_120px_120px_90px]"
                columns={['No.', 'Rule', 'Required', 'Observed', <span key="f" className="block text-right">Finding</span>]}
                rows={([
                  ['Session', 'London open', '07:40', 'Pass', 'text-pass'],
                  ['Sweep of the Asian low', 'Present', 'Present', 'Pass', 'text-pass'],
                  ['Risk to reward', '≥ 2.5', '2.8', 'Pass', 'text-pass'],
                  ['Break of structure', 'Present', 'Not yet', 'Pending', 'text-watch'],
                ] as const).map(([rule, required, observed, finding, tone], i) => [
                  <span key="n" className="doc">{String(i + 1).padStart(2, '0')}</span>,
                  <span key="r" className="ser text-[18px]">{rule}</span>,
                  <span key="q" className="num text-[14px] text-muted">{required}</span>,
                  <span key="o" className="num text-[14px]">{observed}</span>,
                  <span key="f" className={`cap block text-right ${tone}`}>{finding}</span>,
                ])}
              />
              <div className="flex items-center justify-between gap-4 border-t border-ink pt-4 flex-wrap">
                <span className="text-muted text-[14.5px]">Nothing broken, one condition still to confirm.</span>
                <VerdictPill verdict="WATCH" />
              </div>
            </div>
          </div>

          {/* Precedence, stated once. */}
          <div className="mt-14">
            <div className="doc">How the verdict is reached — in this order</div>
            <div className="border-t border-ink mt-2">
              {VERDICTS.map((v, i) => (
                <div key={v.verdict} className="row grid-cols-[34px_170px_minmax(0,1fr)] !items-start !py-4">
                  <span className="doc pt-1">{String(i + 1).padStart(2, '0')}</span>
                  <span><VerdictPill verdict={v.verdict} /></span>
                  <div>
                    <div className="text-[15px]">{v.rule}</div>
                    <div className="text-muted text-[14px] mt-1">{v.why}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="flex flex-col gap-9">
          <AsideSection label="What Vigil will not do">
            <AsideList items={[
              { term: 'Give signals', detail: 'It never suggests a trade or a stock. It only checks the ones you bring.' },
              { term: 'Place trades', detail: 'It is not connected to any broker or account.' },
              { term: 'Fill gaps', detail: 'If something cannot be read or found, it says so rather than assuming.' },
              { term: 'Promise results', detail: 'Following your rules perfectly can still lose money. Vigil measures discipline, not profit.' },
            ]} />
          </AsideSection>

          <AsideSection label="Where AI is used">
            <AsideList items={[
              { term: 'Reading charts', detail: 'Gemini describes what is on a screenshot, and refuses images it cannot read.' },
              { term: 'Reading your strategy', detail: 'Turning plain words into rules, with questions where it is unsure.' },
              { term: 'Optional', detail: 'Both can be done by hand. The checking itself never uses AI.' },
            ]} />
          </AsideSection>

          <AsideSection label="Data">
            <AsideList items={[
              { term: 'Prices and news', detail: 'Finnhub. Shown with their source, never invented when missing.' },
              { term: 'Company figures', detail: 'Financial Modeling Prep, when configured.' },
              { term: 'Your work', detail: 'Kept in this browser, or in your account once you sign in.' },
            ]} />
          </AsideSection>

          <AsideSection label="Cost">
            <p className="text-muted text-[14px] leading-relaxed">
              Free. Every service Vigil uses runs on its free tier.
            </p>
          </AsideSection>
        </aside>
      </div>
    </>
  );
}
