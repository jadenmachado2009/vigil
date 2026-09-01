import type { Rule, Mode, ComparisonOperator } from '@/types/rules';
import type { StrategyParser, ParseResult, ParseQuestion } from './types';
import { getMetric, ruleableMetrics } from '@/lib/metrics/catalog';
import { ProviderUnavailableError } from '@/lib/ai/types';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Model-backed strategy parsing, for descriptions the pattern parser cannot
 * follow. Server-side only.
 *
 * The model's output is treated as a proposal, not a result. Every rule is
 * re-validated against the metric catalog and anything that does not typecheck
 * is dropped. The model is explicitly forbidden from inventing a threshold the
 * user did not state - unstated numbers must come back as questions - and any
 * rule it returns without a number is converted to a question here regardless.
 */
export class GeminiStrategyParser implements StrategyParser {
  readonly name = 'Gemini';
  readonly isMock = false;

  constructor(
    private readonly apiKey: string,
    private readonly model = process.env['GEMINI_TEXT_MODEL'] || 'gemini-2.0-flash',
  ) {}

  async parse({ description, mode, answers = {} }: {
    description: string; mode: Mode; answers?: Record<string, string>;
  }): Promise<ParseResult> {
    if (!this.apiKey) throw new ProviderUnavailableError('No parser API key is configured.');

    const metrics = ruleableMetrics(mode);
    const catalog = metrics
      .map((m) => `${m.id} (${m.kind}${m.kind === 'numeric' ? `, ${m.unit}` : ''}): ${m.description}`)
      .join('\n');

    const prompt = [
      `Convert a ${mode} strategy description into structured rules.`,
      '',
      'Return JSON: { "rules": [...], "questions": [...], "unmatched": [...], "name": string }',
      '',
      'A rule is one of:',
      '{ "metric": id, "kind": "numeric", "operator": ">="|"<="|">"|"<", "value": number, "mandatory": bool }',
      '{ "metric": id, "kind": "boolean", "expected": bool, "mandatory": bool }',
      '{ "metric": id, "kind": "temporal", "start": "HH:mm", "end": "HH:mm", "timezone": IANA, "mandatory": bool }',
      '',
      'A question is: { "metric": id, "question": string, "kind": "threshold"|"session" }',
      '',
      'Hard rules:',
      '- NEVER invent a number the user did not state. "high ROIC" is a question, not a rule.',
      '- Use only metric ids from the list. Anything else goes in "unmatched" as the raw phrase.',
      '- Hedged wording ("ideally", "prefer") means mandatory: false.',
      '- Do not judge the strategy or add rules the user did not describe.',
      '',
      'Metrics:',
      catalog,
      '',
      Object.keys(answers).length > 0
        ? `Answers already given: ${JSON.stringify(answers)}`
        : '',
      'Description:',
      description,
    ].join('\n');

    let response: Response;
    try {
      response = await fetch(`${ENDPOINT}/${this.model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0 },
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      throw new ProviderUnavailableError(
        `Could not reach the parser: ${error instanceof Error ? error.message : 'network error'}`, true,
      );
    }
    if (response.status === 429) throw new ProviderUnavailableError('Parser rate limit reached.', true);
    if (!response.ok) throw new ProviderUnavailableError(`Parser returned ${response.status}.`, response.status >= 500);

    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new ProviderUnavailableError('Parser returned an empty response.', true);

    let raw: { rules?: unknown[]; questions?: unknown[]; unmatched?: unknown[]; name?: unknown };
    try {
      raw = JSON.parse(text);
    } catch {
      throw new ProviderUnavailableError('Parser returned malformed JSON.', true);
    }

    const allowed = new Set(metrics.map((m) => m.id));
    const rules: Rule[] = [];
    const questions: ParseQuestion[] = [];
    let counter = 0;

    for (const candidate of Array.isArray(raw.rules) ? raw.rules : []) {
      const rule = validateRule(candidate, allowed, () => `nl_${(counter += 1)}`);
      if (rule) rules.push(rule);
      else if (isRecord(candidate) && typeof candidate['metric'] === 'string' && allowed.has(candidate['metric'])) {
        // Recognised the metric but the rule did not typecheck - most often a
        // numeric rule with no value. Ask rather than discard.
        const def = getMetric(candidate['metric']);
        questions.push({
          id: `${candidate['metric']}:threshold`, metric: candidate['metric'], kind: 'threshold',
          question: `What ${def?.label ?? candidate['metric']} threshold?`,
          ...(def?.unit ? { unit: def.unit } : {}),
        });
      }
    }

    for (const candidate of Array.isArray(raw.questions) ? raw.questions : []) {
      if (!isRecord(candidate)) continue;
      const metric = candidate['metric'];
      if (typeof metric !== 'string' || !allowed.has(metric)) continue;
      if (questions.some((q) => q.metric === metric)) continue;
      const kind = candidate['kind'] === 'session' ? 'session' : 'threshold';
      questions.push({
        id: `${metric}:${kind}`, metric, kind,
        question: typeof candidate['question'] === 'string'
          ? candidate['question']
          : `What ${getMetric(metric)?.label ?? metric} threshold?`,
        ...(getMetric(metric)?.unit ? { unit: getMetric(metric)!.unit } : {}),
      });
    }

    return {
      mode,
      rules: rules.filter((r) => !questions.some((q) => q.metric === r.metric)),
      questions,
      unmatched: (Array.isArray(raw.unmatched) ? raw.unmatched : []).filter((u): u is string => typeof u === 'string'),
      meta: {},
      ...(typeof raw.name === 'string' && raw.name ? { suggestedName: raw.name } : {}),
      parserName: `${this.name} (${this.model})`,
      isMock: false,
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const OPERATORS: ComparisonOperator[] = ['>=', '<=', '>', '<', '==', '!='];

function validateRule(candidate: unknown, allowed: Set<string>, nextId: () => string): Rule | null {
  if (!isRecord(candidate)) return null;
  const metric = candidate['metric'];
  if (typeof metric !== 'string' || !allowed.has(metric)) return null;
  const def = getMetric(metric);
  if (!def) return null;

  const base = {
    id: nextId(),
    label: def.label,
    mandatory: candidate['mandatory'] !== false,
    onFail: 'reject' as const,
    enabled: true,
  };

  if (def.kind === 'numeric') {
    const value = candidate['value'];
    const operator = candidate['operator'];
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    if (typeof operator !== 'string' || !OPERATORS.includes(operator as ComparisonOperator)) return null;
    return { ...base, kind: 'numeric', metric, operator: operator as ComparisonOperator, value, unit: def.unit };
  }
  if (def.kind === 'boolean') {
    return { ...base, kind: 'boolean', metric, expected: candidate['expected'] !== false };
  }
  if (def.kind === 'temporal') {
    const start = candidate['start'];
    const end = candidate['end'];
    const timezone = candidate['timezone'];
    if (typeof start !== 'string' || typeof end !== 'string' || typeof timezone !== 'string') return null;
    if (!/^\d{1,2}:\d{2}$/.test(start) || !/^\d{1,2}:\d{2}$/.test(end)) return null;
    return { ...base, kind: 'temporal', metric, window: { start, end, timezone } };
  }
  return null;
}
