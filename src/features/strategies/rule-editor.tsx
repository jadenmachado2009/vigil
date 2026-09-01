'use client';

import type { Rule, ComparisonOperator } from '@/types/rules';
import { getMetric } from '@/lib/metrics/catalog';
import { ruleProblem, TIMEZONES } from './rule-defaults';

const OPERATORS: { value: ComparisonOperator; label: string }[] = [
  { value: '>=', label: '≥' }, { value: '<=', label: '≤' },
  { value: '>', label: '>' }, { value: '<', label: '<' },
  { value: '==', label: '=' }, { value: '!=', label: '≠' },
];

interface Props {
  rule: Rule;
  onChange: (rule: Rule) => void;
  onRemove: () => void;
}

export function RuleEditor({ rule, onChange, onRemove }: Props) {
  const metric = getMetric(rule.metric);
  const problem = ruleProblem(rule);
  const unitSuffix = rule.kind === 'numeric' ? (rule.unit === 'percent' ? '%' : rule.unit === 'multiple' ? 'x' : '') : '';

  return (
    <div className="border-b border-line last:border-0 px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <div className="min-w-[160px] flex-1">
          <div className="font-bold">{metric?.label ?? rule.metric}</div>
          {metric && <div className="text-faint text-[12px] mt-0.5">{metric.description}</div>}
        </div>

        {/* --- condition --------------------------------------------------- */}
        <div className="flex items-center gap-2">
          {rule.kind === 'numeric' && (
            <>
              <select
                aria-label="Operator"
                className="field !w-auto !mt-0 !py-2"
                value={rule.operator}
                onChange={(e) => onChange({ ...rule, operator: e.target.value as ComparisonOperator })}
              >
                {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <div className="relative">
                <input
                  aria-label={`${metric?.label ?? rule.metric} threshold`}
                  type="number"
                  step="any"
                  className="field !w-[110px] !mt-0 !py-2 pr-7"
                  value={Number.isFinite(rule.value) ? rule.value : ''}
                  onChange={(e) => onChange({ ...rule, value: e.target.value === '' ? NaN : Number(e.target.value) })}
                />
                {unitSuffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint text-[12px]">{unitSuffix}</span>}
              </div>
            </>
          )}

          {rule.kind === 'boolean' && (
            <select
              aria-label="Expected"
              className="field !w-auto !mt-0 !py-2"
              value={rule.expected ? 'true' : 'false'}
              onChange={(e) => onChange({ ...rule, expected: e.target.value === 'true' })}
            >
              <option value="true">must be present</option>
              <option value="false">must be absent</option>
            </select>
          )}

          {rule.kind === 'temporal' && (
            <>
              <input aria-label="Session start" className="field !w-[80px] !mt-0 !py-2" value={rule.window.start}
                onChange={(e) => onChange({ ...rule, window: { ...rule.window, start: e.target.value } })} />
              <span className="text-faint">–</span>
              <input aria-label="Session end" className="field !w-[80px] !mt-0 !py-2" value={rule.window.end}
                onChange={(e) => onChange({ ...rule, window: { ...rule.window, end: e.target.value } })} />
              <select aria-label="Timezone" className="field !w-auto !mt-0 !py-2" value={rule.window.timezone}
                onChange={(e) => onChange({ ...rule, window: { ...rule.window, timezone: e.target.value } })}>
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </>
          )}

          {rule.kind === 'categorical' && (
            <>
              <select aria-label="Set operator" className="field !w-auto !mt-0 !py-2" value={rule.operator}
                onChange={(e) => onChange({ ...rule, operator: e.target.value as 'in' | 'not_in' })}>
                <option value="in">one of</option>
                <option value="not_in">not one of</option>
              </select>
              <input aria-label="Values" placeholder="comma separated" className="field !w-[190px] !mt-0 !py-2"
                value={rule.values.join(', ')}
                onChange={(e) => onChange({ ...rule, values: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })} />
            </>
          )}
        </div>

        {/* --- policy ------------------------------------------------------ */}
        <select
          aria-label="Requirement"
          className="field !w-auto !mt-0 !py-2"
          value={rule.mandatory ? 'required' : 'optional'}
          onChange={(e) => onChange({ ...rule, mandatory: e.target.value === 'required' })}
        >
          <option value="required">Required</option>
          <option value="optional">Optional</option>
        </select>

        {rule.mandatory && (
          <select
            aria-label="On failure"
            className="field !w-auto !mt-0 !py-2"
            value={rule.onFail}
            onChange={(e) => onChange({ ...rule, onFail: e.target.value as 'reject' | 'watch' })}
            title="What a failure of this rule means for the verdict"
          >
            <option value="reject">fails → Rejected</option>
            <option value="watch">fails → Watch</option>
          </select>
        )}

        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${metric?.label ?? rule.metric}`}
          className="text-faint hover:text-danger px-2 py-1 cursor-pointer text-[18px] leading-none"
        >
          ×
        </button>
      </div>
      {problem && <div className="text-warn text-[12px] mt-2">{problem}</div>}
    </div>
  );
}
