'use client';

import { useState } from 'react';
import type { Rule, Mode, StrategyMeta } from '@/types/rules';
import type { ParseResult, ParseQuestion } from '@/lib/strategy-parser/types';
import { getMetric } from '@/lib/metrics/catalog';
import { Button, Card, Empty } from '@/components/ui';

const EXAMPLES: Record<Mode, string> = {
  trading:
    'HTF fair value gap, then a 5m FVG with inverse FVG confirmation during the NY AM session, minimum RR 2, ideally an external liquidity target.',
  investing:
    'Companies growing revenue and EPS above 15%, ROIC above 15%, positive free cash flow, debt to EBITDA below 2 and forward PE below 35.',
};

interface Props {
  mode: Mode;
  onReady: (payload: { rules: Rule[]; name: string; description: string; meta: StrategyMeta }) => void;
  onSkip: () => void;
}

export function DescribeStrategy({ mode, onReady, onSkip }: Props) {
  const [description, setDescription] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function parse(nextAnswers = answers) {
    if (!description.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/strategies/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, mode, answers: nextAnswers }),
      });
      const data = (await response.json()) as { result?: ParseResult; warnings?: string[]; error?: string };
      if (!response.ok || !data.result) {
        setError(data.error ?? 'Could not read that.');
        return;
      }
      setResult(data.result);
      setWarnings(data.warnings ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that.');
    } finally {
      setBusy(false);
    }
  }

  function answer(question: ParseQuestion, value: string) {
    const next = { ...answers, [question.id]: value };
    setAnswers(next);
    void parse(next);
  }

  const open = result?.questions ?? [];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-5 items-start">
      <Card className="p-4">
        <div className="label">Describe it</div>
        <p className="text-faint text-[12px] mt-1.5 leading-snug">
          Plain English. Anything left vague becomes a question rather than a guess.
        </p>
        <textarea
          className="field mt-3 min-h-[150px] leading-relaxed"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={EXAMPLES[mode]}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void parse(); }}
        />
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <Button onClick={() => parse()} disabled={busy || !description.trim()}>
            {busy ? 'Reading…' : 'Read it'}
          </Button>
          <button
            type="button"
            onClick={() => setDescription(EXAMPLES[mode])}
            className="text-[12px] text-faint hover:text-ink cursor-pointer whitespace-nowrap"
          >
            Use an example
          </button>
          <span className="ml-auto text-dim text-[11px]">
            <span className="kbd">⌘</span> <span className="kbd">↵</span>
          </span>
        </div>
        {error && <p className="text-fail text-[12px] mt-2">{error}</p>}

        <div className="border-t border-line mt-4 pt-3">
          <button type="button" onClick={onSkip} className="text-[12px] text-faint hover:text-ink cursor-pointer">
            Skip and build it by hand →
          </button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {!result ? (
          <Empty>Nothing read yet.</Empty>
        ) : (
          <>
            {open.length > 0 && (
              <div className="border-b border-line">
                <div className="row row-head grid-cols-1">
                  {open.length} question{open.length > 1 ? 's' : ''} before this is usable
                </div>
                {open.map((question) => (
                  <div key={question.id} className="px-3 py-3 border-b border-line last:border-0">
                    <div className="leading-snug">{question.question}</div>
                    {question.quote && (
                      <div className="text-dim text-[11px] mt-1 italic">“{question.quote}”</div>
                    )}
                    <div className="flex gap-1.5 mt-2 flex-wrap items-center">
                      {question.suggestions?.map((suggestion) => (
                        <button
                          key={suggestion.value}
                          type="button"
                          onClick={() => answer(question, suggestion.value)}
                          className="num text-[12px] px-2 py-1 rounded-[3px] border border-line-strong text-muted hover:text-ink hover:border-[#3d454f] cursor-pointer"
                        >
                          {suggestion.label}
                        </button>
                      ))}
                      <input
                        className="field num !w-[88px] !py-1"
                        placeholder={question.kind === 'session' ? 'ny am' : 'value'}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const value = (e.target as HTMLInputElement).value.trim();
                            if (value) answer(question, value);
                          }
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="row row-head grid-cols-[minmax(0,1fr)_auto]">
              <div>Rules read</div>
              <div className="num">{result.rules.length}</div>
            </div>
            {result.rules.length === 0 ? (
              <Empty>No rules yet — answer the questions above.</Empty>
            ) : (
              result.rules.map((rule) => (
                <div key={rule.id} className="row grid-cols-[minmax(0,1fr)_auto_58px]">
                  <div className="truncate">{getMetric(rule.metric)?.label ?? rule.metric}</div>
                  <div className="num text-muted">{describe(rule)}</div>
                  <div className={`num text-[11px] text-right ${rule.mandatory ? 'text-muted' : 'text-dim'}`}>
                    {rule.mandatory ? 'required' : 'optional'}
                  </div>
                </div>
              ))
            )}

            {result.unmatched.length > 0 && (
              <div className="border-t border-line px-3 py-2.5">
                <div className="label">Not understood</div>
                {result.unmatched.map((phrase, i) => (
                  <div key={i} className="text-dim text-[12px] mt-1 italic">“{phrase}”</div>
                ))}
                <div className="text-dim text-[11px] mt-1.5">Add these by hand in the builder.</div>
              </div>
            )}

            {warnings.map((warning, i) => (
              <div key={i} className="border-t border-line px-3 py-2 text-watch text-[12px]">{warning}</div>
            ))}

            <div className="border-t border-line px-3 py-3 flex items-center gap-2 flex-wrap">
              <Button
                disabled={result.rules.length === 0}
                onClick={() => onReady({
                  rules: result.rules,
                  name: result.suggestedName ?? '',
                  description: description.trim(),
                  meta: result.meta,
                })}
              >
                Review in builder →
              </Button>
              <span className="text-dim text-[11px]">
                {open.length > 0 ? 'Unanswered questions are left out.' : 'Nothing is saved until you review it.'}
              </span>
            </div>
            <div className="border-t border-line px-3 py-2 text-dim text-[11px]">
              Read by: {result.parserName}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function describe(rule: Rule): string {
  switch (rule.kind) {
    case 'numeric': {
      const suffix = rule.unit === 'percent' ? '%' : rule.unit === 'multiple' ? 'x' : '';
      const symbol = { '>=': '≥', '<=': '≤', '>': '>', '<': '<', '==': '=', '!=': '≠' }[rule.operator];
      return `${symbol} ${rule.value}${suffix}`;
    }
    case 'boolean': return rule.expected ? 'present' : 'absent';
    case 'temporal': return `${rule.window.start}–${rule.window.end}`;
    case 'categorical': return rule.values.join(', ') || '—';
  }
}
