'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { StrategyWithVersion } from '@/lib/repository/types';
import type { AnalysisRecord } from '@/types/analysis';
import type { Analysis } from '@/types/results';
import type { ObservationSet } from '@/types/observations';
import { strategyRepository, analysisRepository } from '@/lib/repository/client';
import { getMetric } from '@/lib/metrics/catalog';
import type { MetricDef } from '@/types/metrics';
import { Button, Card, Empty } from '@/components/ui';
import { VerdictPanel } from './verdict-panel';

const MAX_IMAGES = 4;
const MAX_BYTES = 5 * 1024 * 1024;

interface Upload {
  name: string;
  mimeType: string;
  base64: string;
  preview: string;
}

/**
 * What the trader reports seeing on the chart. "Not sure" is the absence of an
 * entry, which the engine reads as no data — it is never counted as a pass.
 */
type Seen = 'present' | 'absent' | 'not_yet';

interface ApiResponse {
  analysis: Analysis;
  observations: ObservationSet;
  provider: { name: string; isMock: boolean };
  warnings: string[];
  error?: string;
}

function Labeled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="field-label block">
      {label}
      {children}
      {hint && <span className="block text-faint font-normal text-[11px] mt-1.5">{hint}</span>}
    </label>
  );
}

export function OpportunityChecker() {
  const [strategies, setStrategies] = useState<StrategyWithVersion[] | null>(null);
  const [strategyId, setStrategyId] = useState('');
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [manual, setManual] = useState({ instrument: '', direction: '', entry: '', stop: '', target: '', entry_time: '' });
  const [seen, setSeen] = useState<Record<string, Seen>>({});
  const [notes, setNotes] = useState('');
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ record: AnalysisRecord; warnings: string[] } | null>(null);

  useEffect(() => {
    void strategyRepository.list().then((all) => {
      const trading = all.filter((s) => s.strategy.mode === 'trading' && s.strategy.status === 'active');
      setStrategies(trading);
      if (trading[0]) setStrategyId(trading[0].strategy.id);
    });
  }, []);

  const selected = useMemo(
    () => (strategies ?? []).find((s) => s.strategy.id === strategyId) ?? null,
    [strategies, strategyId],
  );

  // A different strategy asks about different conditions.
  useEffect(() => { setSeen({}); }, [strategyId]);

  /** The strategy's chart conditions: things a person can see, not things code computes. */
  const structural = useMemo(() => {
    if (!selected) return [] as { metric: MetricDef; label: string }[];
    const out: { metric: MetricDef; label: string }[] = [];
    const taken = new Set<string>();
    for (const rule of selected.version.rules) {
      if (!rule.enabled || rule.kind !== 'boolean' || taken.has(rule.metric)) continue;
      const metric = getMetric(rule.metric);
      if (!metric || metric.origin !== 'observed' || metric.mode === 'investing') continue;
      taken.add(rule.metric);
      out.push({ metric, label: rule.label });
    }
    return out;
  }, [selected]);

  function mark(metricId: string, value: Seen | null) {
    setSeen((current) => {
      const next = { ...current };
      if (value === null) delete next[metricId];
      else next[metricId] = value;
      return next;
    });
  }

  async function addFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    const next: Upload[] = [];
    for (const file of Array.from(files).slice(0, MAX_IMAGES - uploads.length)) {
      if (file.size > MAX_BYTES) {
        setError(`${file.name} is larger than 5 MB.`);
        continue;
      }
      const buffer = await file.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] as number);
      const base64 = btoa(binary);
      next.push({ name: file.name, mimeType: file.type, base64, preview: `data:${file.type};base64,${base64}` });
    }
    setUploads((current) => [...current, ...next].slice(0, MAX_IMAGES));
  }

  async function run() {
    if (!selected || running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        strategy: selected.version,
        images: uploads.map(({ mimeType, base64 }) => ({ mimeType, base64 })),
        manual: {
          ...Object.fromEntries(
            Object.entries(manual)
              .filter(([, v]) => v !== '')
              .map(([key, value]) => {
                if (['entry', 'stop', 'target'].includes(key)) return [key, Number(value)];
                // datetime-local gives a local wall-clock string with no zone; the
                // engine needs an absolute instant.
                if (key === 'entry_time') return [key, new Date(value).toISOString()];
                return [key, value];
              }),
          ),
          // What the trader saw. "Not yet" is observable but unresolved, which
          // the engine turns into WATCH rather than a failure.
          ...Object.fromEntries(
            Object.entries(seen).map(([metricId, value]) => [
              metricId,
              value === 'present' ? true : value === 'absent' ? false : { value: false, pending: true },
            ]),
          ),
        },
        notes,
      };
      const response = await fetch('/api/analyze/chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok) {
        setError(data.error ?? `The analysis failed (${response.status}).`);
        return;
      }

      const record: AnalysisRecord = {
        id: `an_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        createdAt: data.analysis.evaluatedAt,
        mode: 'trading',
        subject: manual.instrument.trim() || String(data.observations['instrument']?.value ?? 'Unnamed setup'),
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
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      };
      await analysisRepository.save(record);
      setResult({ record, warnings: data.warnings });
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
          You need an active trading strategy before you can check a setup.
          <div className="mt-5">
            <Link href="/strategies/new?mode=trading"><Button>Build one</Button></Link>
          </div>
        </Empty>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-6 items-start">
      <Card className="p-4">
        <div className="cap">Trading setup</div>

        <div className="mt-3 flex flex-col gap-3">
          <Labeled label="Strategy">
            <select className="field" value={strategyId} onChange={(e) => setStrategyId(e.target.value)}>
              {strategies.map(({ strategy, version }) => (
                <option key={strategy.id} value={strategy.id}>
                  {strategy.name} (v{version.version}, {version.rules.length} rules)
                </option>
              ))}
            </select>
          </Labeled>

          {/* An editorial drop area, not a modern SaaS dropzone. */}
          <div>
            <div className="doc mb-2">Chart</div>
            <label
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void addFiles(e.dataTransfer.files);
              }}
              className={`block border border-dashed px-4 py-7 text-center cursor-pointer ${
                dragging ? 'border-ink bg-paper-2' : 'border-rule hover:border-ink'
              }`}
            >
              <input
                className="sr-only"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                disabled={uploads.length >= MAX_IMAGES}
                onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }}
              />
              {uploads.length > 0 ? (
                <span className="cap !text-ink">
                  {uploads.length === 1 ? 'Chart received' : `${uploads.length} charts received`}
                </span>
              ) : (
                <>
                  <span className="cap block">Drop chart screenshot here</span>
                  <span className="doc block mt-2">or choose file</span>
                </>
              )}
            </label>
            <div className="doc mt-2">PNG, JPEG or WebP · up to {MAX_IMAGES} · 5 MB each</div>
          </div>

          {structural.length > 0 && (
            <div>
              <div className="doc mb-1">What you see</div>
              <p className="text-faint text-[11.5px] leading-snug mb-2">
                Mark what's on your chart. Not sure stays as no data — it is never counted as a pass.
              </p>
              <div className="border-t border-ink">
                {structural.map(({ metric, label }) => {
                  const current = seen[metric.id] ?? null;
                  const options: { value: Seen | null; text: string }[] = [
                    { value: 'present', text: 'Present' },
                    { value: 'absent', text: 'Absent' },
                    ...(metric.group === 'confirmation' ? [{ value: 'not_yet' as Seen, text: 'Not yet' }] : []),
                    { value: null, text: 'Not sure' },
                  ];
                  return (
                    <div key={metric.id} className="py-2.5 border-b border-hair">
                      <div className="text-[12.5px]">{label}</div>
                      <div className="flex flex-wrap gap-1.5 mt-1.5" role="radiogroup" aria-label={label}>
                        {options.map((option) => {
                          const active = current === option.value;
                          return (
                            <button
                              key={option.text}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              onClick={() => mark(metric.id, option.value)}
                              className={`cap px-2 py-1 cursor-pointer border ${
                                active ? 'bg-ink !text-paper border-ink' : 'border-rule hover:border-ink'
                              }`}
                            >
                              {option.text}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Instrument">
              <input className="field" value={manual.instrument} placeholder="e.g. EURUSD"
                onChange={(e) => setManual({ ...manual, instrument: e.target.value })} />
            </Labeled>
            <Labeled label="Direction">
              <select className="field" value={manual.direction} onChange={(e) => setManual({ ...manual, direction: e.target.value })}>
                <option value="">From chart</option>
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </Labeled>
            <Labeled label="Entry">
              <input className="field num" type="number" step="any" value={manual.entry}
                onChange={(e) => setManual({ ...manual, entry: e.target.value })} />
            </Labeled>
            <Labeled label="Stop">
              <input className="field num" type="number" step="any" value={manual.stop}
                onChange={(e) => setManual({ ...manual, stop: e.target.value })} />
            </Labeled>
            <Labeled label="Target">
              <input className="field num" type="number" step="any" value={manual.target}
                onChange={(e) => setManual({ ...manual, target: e.target.value })} />
            </Labeled>
            <Labeled label="Entry time" hint="Your local time. Used for session rules.">
              {/* Kept as the raw datetime-local string; converted to ISO at submit.
                  Feeding an ISO string back into this input makes the browser reject it. */}
              <input className="field" type="datetime-local" value={manual.entry_time}
                onChange={(e) => setManual({ ...manual, entry_time: e.target.value })} />
            </Labeled>
          </div>

          <Labeled label="Notes" hint="Context for the reader. Never used to decide a verdict.">
            <textarea className="field min-h-[80px]" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="What are you seeing?" />
          </Labeled>

          <div>
            <Button onClick={run} disabled={running} className="w-full">
              {running ? 'Analysing…' : 'Check against strategy'}
            </Button>
            {error && <p className="text-fail mt-3">{error}</p>}
          </div>

          <p className="text-faint text-[12px] leading-relaxed">
            Risk/reward is calculated from your levels by the app, never read from the chart or
            supplied by a model.
          </p>
        </div>
      </Card>

      {result ? (
        <VerdictPanel record={result.record} warnings={result.warnings}
          demoLabel="Chart observations were generated locally, not read from your screenshot." />
      ) : (
        <Card>
          <Empty>
            
            Mark what you see and enter your levels — or upload a chart.
          </Empty>
        </Card>
      )}
    </div>
  );
}
