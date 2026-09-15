'use client';

import { useMemo, useState } from 'react';
import { computeDcf, type DcfInput, type DcfProblem } from '@/lib/calculations/dcf';
import { formatRatio, formatPercent } from '@/lib/format';

const PROBLEM_TEXT: Record<DcfProblem, string> = {
  terminal_growth_not_below_discount: 'Terminal growth must be below the discount rate, or the model is undefined.',
  non_positive_shares: 'Shares outstanding must be above zero.',
  years_out_of_range: 'Forecast length must be a whole number of years, 1 to 30.',
  non_finite_input: 'Every field needs a number.',
};

const money = (n: number) =>
  Math.abs(n) >= 1e9 ? `${formatRatio(n / 1e9, 2)}B`
  : Math.abs(n) >= 1e6 ? `${formatRatio(n / 1e6, 1)}M`
  : formatRatio(n, 0);

function Field({ label, value, onChange, suffix, hint }: {
  label: string; value: string; onChange: (v: string) => void; suffix?: string; hint?: string;
}) {
  return (
    <label className="field-label block">
      {label}
      <div className="relative mt-1.5">
        <input className={`field num !py-1.5 ${suffix ? 'pr-7' : ''}`} type="number" step="any" value={value}
          onChange={(e) => onChange(e.target.value)} />
        {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim text-[12.5px]">{suffix}</span>}
      </div>
      {hint && <span className="block text-faint font-normal text-[12.5px] mt-1 normal-case tracking-normal">{hint}</span>}
    </label>
  );
}

/**
 * Your assumptions in, the arithmetic out. Pre-filled from what the analysis
 * observed where it can be; everything else is yours to state.
 */
export function DcfPanel({ observedFcf, price, currency }: {
  observedFcf: number | null; price: number | null; currency?: string;
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    freeCashFlow: observedFcf !== null ? String(Math.round(observedFcf)) : '',
    growthPercent: '10',
    terminalGrowthPercent: '2.5',
    discountPercent: '9',
    years: '5',
    sharesOutstanding: '',
    netCash: '0',
  });

  const input: DcfInput = useMemo(() => ({
    freeCashFlow: Number(f.freeCashFlow),
    growthPercent: Number(f.growthPercent),
    terminalGrowthPercent: Number(f.terminalGrowthPercent),
    discountPercent: Number(f.discountPercent),
    years: Number(f.years),
    sharesOutstanding: Number(f.sharesOutstanding),
    netCash: Number(f.netCash),
    price,
  }), [f, price]);

  const ready = f.freeCashFlow !== '' && f.sharesOutstanding !== '';
  const out = useMemo(() => (ready ? computeDcf(input) : null), [ready, input]);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });

  return (
    <section className="border-t border-rule pt-3">
      <button type="button" onClick={() => setOpen(!open)} className="flex items-baseline justify-between w-full cursor-pointer">
        <span className="doc">Discounted cash flow — your assumptions</span>
        <span className="num text-dim">{open ? '–' : '+'}</span>
      </button>
      {open && (
        <div className="mt-4 grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Free cash flow" value={f.freeCashFlow} onChange={set('freeCashFlow')}
              hint={observedFcf !== null ? 'Pre-filled from the analysis.' : 'Most recent year.'} />
            <Field label="Shares outstanding" value={f.sharesOutstanding} onChange={set('sharesOutstanding')} />
            <Field label="Growth" value={f.growthPercent} onChange={set('growthPercent')} suffix="%" hint="During the forecast." />
            <Field label="Forecast" value={f.years} onChange={set('years')} suffix="yrs" />
            <Field label="Discount rate" value={f.discountPercent} onChange={set('discountPercent')} suffix="%" hint="Your required return." />
            <Field label="Terminal growth" value={f.terminalGrowthPercent} onChange={set('terminalGrowthPercent')} suffix="%" hint="Forever after." />
            <Field label="Net cash" value={f.netCash} onChange={set('netCash')} hint="Cash minus debt. Negative if indebted." />
          </div>

          <div>
            {!ready && <p className="text-muted text-[14.5px]">Enter free cash flow and shares outstanding.</p>}
            {out && 'problem' in out && <p className="text-watch text-[14.5px]">{PROBLEM_TEXT[out.problem]}</p>}
            {out && !('problem' in out) && (
              <>
                <div className="doc">Implied value per share</div>
                <div className="num text-[34px] leading-none mt-2">
                  {formatRatio(out.perShare, 2)} <span className="text-dim text-[16px]">{currency ?? ''}</span>
                </div>
                {out.impliedDifferencePercent !== null && (
                  <div className={`num text-[15px] mt-2 ${out.impliedDifferencePercent > 0 ? 'text-pass' : out.impliedDifferencePercent < 0 ? 'text-fail' : ''}`}>
                    {out.impliedDifferencePercent > 0 ? '+' : ''}{formatPercent(out.impliedDifferencePercent)} against the price of {formatRatio(price as number, 2)}
                  </div>
                )}
                <div className="border-t border-hair mt-4 pt-3 grid grid-cols-2 gap-y-2 text-[14px]">
                  <span className="text-muted">PV of forecast</span><span className="num text-right">{money(out.presentValueOfForecast)}</span>
                  <span className="text-muted">PV of terminal</span><span className="num text-right">{money(out.presentValueOfTerminal)}</span>
                  <span className="text-muted">Enterprise value</span><span className="num text-right">{money(out.enterpriseValue)}</span>
                  <span className="text-muted">Equity value</span><span className="num text-right">{money(out.equityValue)}</span>
                </div>
                <p className={`text-[13px] mt-3 leading-snug ${out.terminalShare > 75 ? 'text-watch' : 'text-faint'}`}>
                  {formatPercent(out.terminalShare, 0)} of this value rests on the terminal assumption — the part least
                  supported by evidence.
                </p>
              </>
            )}
            <p className="text-dim text-[12.5px] mt-4 leading-snug">
              Arithmetic on assumptions you entered. Vigil chose none of them and does not judge the result.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
