'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { StrategyWithVersion } from '@/lib/repository/types';
import type { AnalysisRecord } from '@/types/analysis';
import type { Analysis } from '@/types/results';
import type { ObservationSet } from '@/types/observations';
import { strategyRepository } from '@/lib/repository/local';
import { analysisRepository } from '@/lib/repository/analyses';
import { getMetric } from '@/lib/metrics/catalog';
import { Button, Card, Empty } from '@/components/ui';
import { VerdictPanel } from './verdict-panel';

interface CompanyRef { ticker: string; name: string; exchange?: string }

interface ApiResponse {
  analysis: Analysis;
  observations: ObservationSet;
  company: { ticker: string; name: string; sector?: string; price?: number; currency?: string };
  provider: { name: string; isMock: boolean };
  warnings: string[];
  error?: string;
}

export function CompanyChecker() {
  const [strategies, setStrategies] = useState<StrategyWithVersion[] | null>(null);
  const [strategyId, setStrategyId] = useState('');
  const [ticker, setTicker] = useState('');
  const [suggestions, setSuggestions] = useState<CompanyRef[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [qualitative, setQualitative] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    record: AnalysisRecord;
    warnings: string[];
    company: ApiResponse['company'];
  } | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void strategyRepository.list().then((all) => {
      const investing = all.filter((s) => s.strategy.mode === 'investing' && s.strategy.status === 'active');
      setStrategies(investing);
      if (investing[0]) setStrategyId(investing[0].strategy.id);
    });
  }, []);

  const selected = useMemo(
    () => (strategies ?? []).find((s) => s.strategy.id === strategyId) ?? null,
    [strategies, strategyId],
  );

  /** Rules a data feed cannot answer. The user must judge these, or they stay unknown. */
  const qualitativeRules = useMemo(() => {
    if (!selected) return [];
    return selected.version.rules
      .filter((r) => r.enabled && r.kind === 'boolean' && getMetric(r.metric)?.group === 'qualitative')
      .map((r) => ({ rule: r, metric: getMetric(r.metric)! }));
  }, [selected]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const query = ticker.trim();
    if (query.length < 1) { setSuggestions([]); return; }
    debounce.current = setTimeout(() => {
      void fetch(`/api/companies/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json() as Promise<{ results: CompanyRef[] }>)
        .then((d) => setSuggestions(d.results ?? []))
        .catch(() => setSuggestions([]));
    }, 250);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [ticker]);

  async function run() {
    if (!selected || running || !ticker.trim()) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setShowSuggestions(false);
    try {
      const manual = Object.fromEntries(
        Object.entries(qualitative)
          .filter(([, v]) => v === 'true' || v === 'false')
          .map(([k, v]) => [k, v === 'true']),
      );
      const response = await fetch('/api/analyze/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: selected.version, ticker: ticker.trim(), manual }),
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok) {
        setError(data.error ?? `The analysis failed (${response.status}).`);
        return;
      }
      const record: AnalysisRecord = {
        id: `an_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        createdAt: data.analysis.evaluatedAt,
        mode: 'investing',
        subject: data.company.ticker,
        strategyId: selected.strategy.id,
        strategyName: selected.strategy.name,
        strategyVersionId: selected.version.id,
        strategyVersion: selected.version.version,
        verdict: data.analysis.verdict,
        reason: data.analysis.reason,
        summary: data.analysis.summary,
        results: data.analysis.results,
        computed: data.analysis.computed,
        observations: data.observations,
        provider: data.provider,
      };
      await analysisRepository.save(record);
      setResult({ record, warnings: data.warnings, company: data.company });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The analysis could not be completed.');
    } finally {
      setRunning(false);
    }
  }

  if (strategies === null) return <Card><Empty>Loading strategies…</Empty></Card>;

  if (strategies.length === 0) {
    return (
      <Card>
        <Empty>
          You need an active investment strategy before you can check a company.
          <div className="mt-5">
            <Link href="/strategies/new?mode=investing"><Button>Build one</Button></Link>
          </div>
        </Empty>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-6 items-start">
      <Card className="p-5">
        <h3 className="text-[17px] font-bold">Investment opportunity</h3>
        <p className="text-muted mt-1 text-[13px] leading-relaxed">
          Fundamentals are fetched and compared to your thresholds. Judgement calls stay yours.
        </p>

        <div className="mt-5 flex flex-col gap-4">
          <label className="field-label block">
            Strategy
            <select className="field" value={strategyId} onChange={(e) => setStrategyId(e.target.value)}>
              {strategies.map(({ strategy, version }) => (
                <option key={strategy.id} value={strategy.id}>
                  {strategy.name} (v{version.version}, {version.rules.length} rules)
                </option>
              ))}
            </select>
          </label>

          <label className="field-label block relative">
            Company
            <input
              className="field num uppercase"
              value={ticker}
              placeholder="NVDA"
              autoComplete="off"
              onChange={(e) => { setTicker(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => { if (e.key === 'Enter') void run(); }}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-[#0d1116] border border-line-strong rounded-[9px] overflow-hidden shadow-[0_18px_60px_rgba(0,0,0,.5)]">
                {suggestions.map((s) => (
                  <button
                    key={s.ticker}
                    type="button"
                    onClick={() => { setTicker(s.ticker); setShowSuggestions(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-[#161d24] cursor-pointer flex items-baseline gap-2 font-normal"
                  >
                    <span className="num text-accent text-[13px] w-16 shrink-0">{s.ticker}</span>
                    <span className="text-muted text-[13px] truncate">{s.name}</span>
                  </button>
                ))}
              </div>
            )}
          </label>

          {qualitativeRules.length > 0 && (
            <div className="border-t border-line pt-4">
              <div className="eyebrow">Your judgement</div>
              <p className="text-faint text-[12px] mt-1.5 leading-relaxed">
                No data feed can answer these. Leave unanswered and the rule reports as
                insufficient data rather than being assumed.
              </p>
              <div className="mt-3 flex flex-col gap-3">
                {qualitativeRules.map(({ rule, metric }) => (
                  <label key={rule.id} className="field-label block">
                    {metric.label}
                    <select
                      className="field"
                      value={qualitative[rule.metric] ?? ''}
                      onChange={(e) => setQualitative({ ...qualitative, [rule.metric]: e.target.value })}
                    >
                      <option value="">Not assessed</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <Button onClick={run} disabled={running || !ticker.trim()} className="w-full">
              {running ? 'Fetching and checking…' : 'Check against strategy'}
            </Button>
            {error && <p className="text-danger mt-3 text-[13px]">{error}</p>}
          </div>

          <p className="text-[#5a646f] text-[11px] leading-relaxed">
            Ratios and margins are compared by the app against your thresholds. No model is asked
            whether a valuation is acceptable.
          </p>
        </div>
      </Card>

      {result ? (
        <div className="flex flex-col gap-4">
          <Card className="px-5 py-4">
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <span className="num text-accent text-[15px] font-bold">{result.company.ticker}</span>
                <span className="text-muted ml-3 text-[14px]">{result.company.name}</span>
              </div>
              <div className="flex items-baseline gap-5 text-[12px]">
                {result.company.sector && <span className="text-faint">{result.company.sector}</span>}
                {result.company.price !== undefined && (
                  <span className="num text-[#c3ccd5]">
                    {result.company.price.toFixed(2)} {result.company.currency ?? ''}
                  </span>
                )}
              </div>
            </div>
          </Card>
          <VerdictPanel
            record={result.record}
            warnings={result.warnings}
            demoLabel="These fundamentals were generated locally from the ticker, not taken from filings."
          />
        </div>
      ) : (
        <Card>
          <Empty>
            <div className="num text-[13px] text-faint tracking-widest mb-3">— — —</div>
            Enter a ticker to check it against your rules.
          </Empty>
        </Card>
      )}
    </div>
  );
}
