'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { StrategyWithVersion } from '@/lib/repository/types';
import type { AnalysisRecord } from '@/types/analysis';
import type { Analysis } from '@/types/results';
import type { ObservationSet } from '@/types/observations';
import { strategyRepository, analysisRepository } from '@/lib/repository/client';
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
  const [notes, setNotes] = useState('');
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
        manual: Object.fromEntries(
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
        <div className="label">Trading setup</div>

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

          <Labeled label="Chart screenshots" hint={`PNG, JPEG or WebP. Up to ${MAX_IMAGES} images, 5 MB each.`}>
            <input
              className="field"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              disabled={uploads.length >= MAX_IMAGES}
              onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }}
            />
          </Labeled>

          {uploads.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {uploads.map((upload, index) => (
                <div key={index} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={upload.preview} alt={upload.name} className="h-20 w-28 object-cover rounded-[8px] border border-line" />
                  <button
                    type="button"
                    aria-label={`Remove ${upload.name}`}
                    onClick={() => setUploads(uploads.filter((_, i) => i !== index))}
                    className="absolute -top-2 -right-2 bg-[#1b222a] border border-line rounded-full w-6 h-6 text-faint hover:text-fail cursor-pointer leading-none"
                  >×</button>
                </div>
              ))}
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
            
            Upload a chart or enter levels.
          </Empty>
        </Card>
      )}
    </div>
  );
}
