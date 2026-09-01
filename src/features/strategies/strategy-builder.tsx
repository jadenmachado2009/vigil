'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Rule, Mode, StrategyMeta, Market, StopMethod, TargetMethod, PositionSizing } from '@/types/rules';
import type { MetricDef } from '@/types/metrics';
import { ruleableMetrics } from '@/lib/metrics/catalog';
import { strategyRepository } from '@/lib/repository/client';
import { Button, Card, SectionHead } from '@/components/ui';
import { RuleEditor } from './rule-editor';
import { createRuleForMetric, ruleProblem } from './rule-defaults';

const GROUP_LABELS: Record<string, string> = {
  entry: 'Entry conditions',
  confirmation: 'Confirmation',
  session: 'Session',
  risk: 'Risk',
  target: 'Target',
  growth: 'Growth',
  profitability: 'Profitability',
  'balance-sheet': 'Balance sheet',
  'cash-flow': 'Cash flow',
  valuation: 'Valuation',
  qualitative: 'Qualitative',
  context: 'Context',
  levels: 'Levels',
};

const GROUP_ORDER: Record<Mode, string[]> = {
  trading: ['entry', 'confirmation', 'session', 'risk', 'target'],
  investing: ['growth', 'profitability', 'balance-sheet', 'cash-flow', 'valuation', 'qualitative', 'context'],
};

const MARKETS: Market[] = ['stocks', 'forex', 'crypto', 'futures'];
const STOP_METHODS: StopMethod[] = ['structure', 'atr', 'fixed-distance', 'percent', 'custom'];
const TARGET_METHODS: TargetMethod[] = ['liquidity', 'previous-high-low', 'fixed-rr', 'custom'];
const SIZING: PositionSizing[] = ['fixed-percent', 'fixed-amount', 'manual'];
const TIMEFRAMES = ['1M', '5M', '15M', '30M', '1H', '4H', 'Daily', 'Weekly', 'Monthly'];

export interface BuilderInitial {
  id?: string;
  name: string;
  description: string;
  mode: Mode;
  meta: StrategyMeta;
  rules: Rule[];
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field-label block">
      {label}
      {children}
    </label>
  );
}

export function StrategyBuilder({ initial }: { initial: BuilderInitial }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [meta, setMeta] = useState<StrategyMeta>(initial.meta);
  const [rules, setRules] = useState<Rule[]>(initial.rules);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mode = initial.mode;
  const used = useMemo(() => new Set(rules.map((r) => r.metric)), [rules]);

  const library = useMemo(() => {
    const query = search.trim().toLowerCase();
    const available = ruleableMetrics(mode).filter(
      (m) => !used.has(m.id) && (!query || m.label.toLowerCase().includes(query) || m.description.toLowerCase().includes(query)),
    );
    const groups = new Map<string, MetricDef[]>();
    for (const metric of available) {
      const list = groups.get(metric.group) ?? [];
      list.push(metric);
      groups.set(metric.group, list);
    }
    const order = GROUP_ORDER[mode] ?? [];
    const rank = (group: string) => (order.indexOf(group) + 1 || 99);
    return [...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
  }, [mode, used, search]);

  const mandatoryCount = rules.filter((r) => r.mandatory).length;
  const problems = rules.map(ruleProblem).filter(Boolean).length;
  const canSave = name.trim().length > 0 && rules.length > 0 && mandatoryCount > 0 && problems === 0;

  function addMetric(metric: MetricDef) {
    setRules((current) => [...current, createRuleForMetric(metric)]);
  }

  async function save() {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload = { name: name.trim(), description: description.trim(), rules, meta, mode };
      if (initial.id) await strategyRepository.update(initial.id, payload);
      else await strategyRepository.create(payload);
      router.push('/strategies');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this strategy.');
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_330px] gap-6 items-start">
      <div>
        <Card className="p-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <Labeled label="Strategy name">
              <input className="field" value={name} onChange={(e) => setName(e.target.value)}
                placeholder={mode === 'trading' ? 'e.g. NY AM FVG' : 'e.g. Quality Growth'} />
            </Labeled>
            <Labeled label="Description">
              <input className="field" value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="One line on when this applies" />
            </Labeled>
          </div>

          {mode === 'trading' ? (
            <div className="grid sm:grid-cols-3 gap-4 mt-4">
              <Labeled label="Market">
                <select className="field" value={meta.market ?? ''} onChange={(e) => setMeta({ ...meta, market: e.target.value as Market })}>
                  <option value="">Not set</option>
                  {MARKETS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Labeled>
              <Labeled label="Higher timeframe">
                <select className="field" value={meta.htfTimeframe ?? ''} onChange={(e) => setMeta({ ...meta, htfTimeframe: e.target.value })}>
                  <option value="">Not set</option>
                  {TIMEFRAMES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Labeled>
              <Labeled label="Entry timeframe">
                <select className="field" value={meta.entryTimeframe ?? ''} onChange={(e) => setMeta({ ...meta, entryTimeframe: e.target.value })}>
                  <option value="">Not set</option>
                  {TIMEFRAMES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Labeled>
              <Labeled label="Stop-loss method">
                <select className="field" value={meta.stopMethod ?? ''} onChange={(e) => setMeta({ ...meta, stopMethod: e.target.value as StopMethod })}>
                  <option value="">Not set</option>
                  {STOP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Labeled>
              <Labeled label="Target method">
                <select className="field" value={meta.targetMethod ?? ''} onChange={(e) => setMeta({ ...meta, targetMethod: e.target.value as TargetMethod })}>
                  <option value="">Not set</option>
                  {TARGET_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Labeled>
              <Labeled label="Position sizing">
                <select className="field" value={meta.positionSizing ?? ''} onChange={(e) => setMeta({ ...meta, positionSizing: e.target.value as PositionSizing })}>
                  <option value="">Not set</option>
                  {SIZING.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Labeled>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <Labeled label="Intended holding period">
                <input className="field" value={meta.holdingPeriod ?? ''} onChange={(e) => setMeta({ ...meta, holdingPeriod: e.target.value })} placeholder="e.g. 3–5 years" />
              </Labeled>
              <Labeled label="Universe">
                <input className="field" value={meta.universe ?? ''} onChange={(e) => setMeta({ ...meta, universe: e.target.value })} placeholder="e.g. US large cap" />
              </Labeled>
            </div>
          )}
        </Card>

        <SectionHead
          title="Rules"
          hint="Required rules decide the verdict. Optional rules are reported but never reject an opportunity."
          action={<span className="text-faint text-[12px]">{rules.length} rules · {mandatoryCount} required</span>}
        />
        <Card>
          {rules.length === 0 ? (
            <div className="text-muted text-center py-12 px-5 leading-relaxed">
              No rules yet. Add conditions from the library{' '}
              <span className="xl:hidden">below</span><span className="hidden xl:inline">on the right</span>.
            </div>
          ) : (
            rules.map((rule, index) => (
              <RuleEditor
                key={rule.id}
                rule={rule}
                onChange={(next) => setRules(rules.map((r, i) => (i === index ? next : r)))}
                onRemove={() => setRules(rules.filter((_, i) => i !== index))}
              />
            ))
          )}
        </Card>

        <div className="flex items-center gap-3 mt-5 flex-wrap">
          <Button onClick={save} disabled={!canSave || saving}>
            {saving ? 'Saving…' : initial.id ? 'Save changes' : 'Create strategy'}
          </Button>
          <Button variant="secondary" onClick={() => router.push('/strategies')}>Cancel</Button>
          {!canSave && rules.length > 0 && mandatoryCount === 0 && (
            <span className="text-warn text-[12px]">At least one rule must be required, or no verdict can be reached.</span>
          )}
          {problems > 0 && <span className="text-warn text-[12px]">{problems} rule{problems > 1 ? 's' : ''} still need values.</span>}
          {error && <span className="text-danger text-[12px]">{error}</span>}
        </div>
        {initial.id && (
          <p className="text-faint text-[12px] mt-4 leading-relaxed max-w-[60ch]">
            Editing rules creates a new version of this strategy. Past analyses stay attached to the
            version they were evaluated against, so your historical results keep their meaning.
          </p>
        )}
      </div>

      {/* --- condition library ---------------------------------------------- */}
      <Card className="p-5 xl:sticky xl:top-6">
        <div className="eyebrow">Add condition</div>
        <input
          className="field mt-3"
          placeholder="Search conditions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search conditions"
        />
        <div className="mt-4 max-h-[60vh] overflow-y-auto pr-1">
          {library.length === 0 && <p className="text-faint py-4">Nothing left to add.</p>}
          {library.map(([group, metrics]) => (
            <div key={group} className="mb-4">
              <div className="text-faint text-[11px] font-bold uppercase tracking-wider mb-1.5">
                {GROUP_LABELS[group] ?? group}
              </div>
              <div className="flex flex-col gap-1">
                {metrics.map((metric) => (
                  <button
                    key={metric.id}
                    type="button"
                    onClick={() => addMetric(metric)}
                    title={metric.description}
                    className="text-left px-2.5 py-2 rounded-[7px] hover:bg-[#161c23] text-[#c3ccd5] cursor-pointer flex items-center justify-between gap-2 group"
                  >
                    <span>{metric.label}</span>
                    <span className="text-faint group-hover:text-accent">+</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
