import type { Rule, Mode, ComparisonOperator } from '@/types/rules';
import type { StrategyParser, ParseResult, ParseQuestion } from './types';
import { SYNONYMS, SESSIONS, COMPARATORS, OPTIONAL_MARKERS, NEGATIONS } from './lexicon';
import { getMetric, ruleableMetrics } from '@/lib/metrics/catalog';

/**
 * Deterministic parser for strategy descriptions.
 *
 * This is NOT a model pretending to understand you. It is a pattern parser over
 * a bounded vocabulary: metric names, comparators, numbers and named sessions.
 * That is enough for most of how people actually write rules, it costs nothing,
 * needs no key, and - crucially - it never invents a threshold.
 *
 * Anything it recognises but cannot pin down becomes a question.
 * Anything it does not recognise at all is reported, not discarded.
 */
export class PatternStrategyParser implements StrategyParser {
  readonly name = 'Built-in parser';
  readonly isMock = true;

  async parse({ description, mode, answers = {} }: {
    description: string; mode: Mode; answers?: Record<string, string>;
  }): Promise<ParseResult> {
    const allowed = new Set(ruleableMetrics(mode).map((m) => m.id));
    const lower = description.toLowerCase();

    // Metrics are located positionally across the whole description rather than
    // inside pre-split clauses. Splitting first loses two common shapes:
    // "revenue AND eps above 15%" (one threshold shared by two metrics) and
    // "inverse FVG during the NY AM session" (two metrics in one breath).
    const hits = findMetrics(lower, allowed);
    const numbers = findNumbers(lower);

    const rules: Rule[] = [];
    const questions: ParseQuestion[] = [];
    const claimed = new Set<string>();
    /** Numbers already taken as a metric's own threshold, so a later metric cannot reuse them. */
    const consumed = new Set<number>();
    let counter = 0;
    const nextId = () => `nl_${Date.now().toString(36)}_${(counter += 1)}`;

    for (let i = 0; i < hits.length; i += 1) {
      const hit = hits[i] as MetricHit;
      const def = getMetric(hit.metric);
      if (!def || claimed.has(hit.metric)) continue;
      claimed.add(hit.metric);

      // The span this metric owns: from its own text to the next metric.
      const spanEnd = hits[i + 1]?.start ?? lower.length;
      const span = lower.slice(hit.start, spanEnd);
      const sentence = sentenceAround(lower, hit.start);

      // Qualifiers apply FORWARD to the metric they introduce: "ideally a wide
      // moat", "no liquidity sweep". So the window is the lead-in from the
      // previous metric up to and including this metric's own name - never the
      // text after it, or one "ideally" would make every later rule optional.
      // Bounded at the nearest clause break as well as the previous metric:
      // "not much debt. Ideally a wide moat" must not negate the moat.
      const leadIn = trimToClause(lower.slice(hits[i - 1]?.end ?? 0, hit.end));
      const trailing = lower.slice(hit.end, hit.end + 14);
      const mandatory =
        !OPTIONAL_MARKERS.some((m) => leadIn.includes(m)) && !/^[\s,(]*optional/.test(trailing);
      const negated = NEGATIONS.some((n) => leadIn.includes(n));
      const base = { id: nextId(), label: def.label, mandatory, onFail: 'reject' as const, enabled: true };

      if (def.kind === 'temporal') {
        const named = Object.keys(SESSIONS).find((key) => span.includes(key) || sentence.includes(key));
        const explicit = matchTimeRange(sentence);
        const window = explicit ?? (named ? SESSIONS[named] : undefined);
        if (window) {
          rules.push({
            ...base, kind: 'temporal', metric: hit.metric,
            label: named ? `${SESSIONS[named]!.label} session` : 'Session',
            window: { start: window.start, end: window.end, timezone: window.timezone },
          });
        } else {
          questions.push({
            id: `${hit.metric}:session`, metric: hit.metric, quote: sentence.trim(), kind: 'session',
            question: 'Which session, and in which timezone?',
            suggestions: Object.entries(SESSIONS).slice(0, 4).map(([key, sess]) => ({
              label: `${sess.label} · ${sess.start}–${sess.end}`, value: key,
            })),
          });
        }
        continue;
      }

      if (def.kind === 'boolean') {
        rules.push({ ...base, kind: 'boolean', metric: hit.metric, expected: !negated });
        continue;
      }

      if (def.kind === 'numeric') {
        const answered = answers[`${hit.metric}:threshold`] ?? answers[hit.metric];
        // A number inside this metric's own span, otherwise one shared with the
        // metric that follows when they are joined by "and" or a comma.
        // A ratio is only meaningful for a multiple, never for a percentage.
        const fits = (n: NumberHit) => !n.ratio || def.unit === 'multiple';
        const own = numbers.find((n) => fits(n) && n.start >= hit.start && n.start < spanEnd);
        const shared = own ?? (sharesThresholdWithNext(lower, hit, hits[i + 1])
          ? numbers.find((n) => fits(n) && n.start >= (hits[i + 1] as MetricHit).start)
          : undefined);
        // "a 1:2.5 reward to risk", "15% ROIC": the number comes first. Only the
        // same clause counts, and never a number another metric already took.
        const clauseStart = (() => {
          const from = hits[i - 1]?.end ?? 0;
          const before = lower.slice(from, hit.start);
          const cut = lastClauseBreak(before);
          return cut === -1 ? from : from + cut + 1;
        })();
        const preceding = own || shared ? undefined : [...numbers].reverse().find(
          (n) => fits(n) && n.start >= clauseStart && n.end <= hit.start && !consumed.has(n.start),
        );
        const taken = own ?? preceding;
        if (taken) consumed.add(taken.start);
        const value = own?.value ?? shared?.value ?? preceding?.value ?? (answered !== undefined ? Number(answered) : null);
        const operator = matchComparator(span) ?? matchComparator(sentence) ?? defaultOperator(def.preferred);

        if (value === null || !Number.isFinite(value)) {
          questions.push({
            id: `${hit.metric}:threshold`, metric: hit.metric, quote: sentence.trim(), kind: 'threshold',
            question: `What ${def.label} threshold? You described it without a number.`,
            unit: def.unit,
            ...(SUGGESTIONS[hit.metric] ? { suggestions: SUGGESTIONS[hit.metric] } : {}),
          });
          continue;
        }
        rules.push({
          ...base, kind: 'numeric', metric: hit.metric, operator, value, unit: def.unit,
          label: `${def.label} ${symbol(operator)} ${value}${def.unit === 'percent' ? '%' : def.unit === 'multiple' ? 'x' : ''}`,
        });
        continue;
      }

      if (def.kind === 'categorical') {
        rules.push({ ...base, kind: 'categorical', metric: hit.metric, operator: negated ? 'not_in' : 'in', values: [] });
      }
    }

    return {
      mode,
      rules,
      questions,
      unmatched: findUnmatched(description, hits),
      meta: {},
      ...(rules.length > 0 ? { suggestedName: suggestName(description, mode) } : {}),
      parserName: this.name,
      isMock: true,
    };
  }
}

interface MetricHit { metric: string; start: number; end: number }

/** Longest, non-overlapping metric matches, in the order they appear. */
function findMetrics(lower: string, allowed: Set<string>): MetricHit[] {
  const candidates: MetricHit[] = [];
  for (const [metric, phrases] of Object.entries(SYNONYMS)) {
    if (!allowed.has(metric)) continue;
    for (const phrase of phrases) {
      let from = 0;
      for (;;) {
        const index = lower.indexOf(phrase, from);
        if (index === -1) break;
        candidates.push({ metric, start: index, end: index + phrase.length });
        from = index + 1;
      }
    }
  }
  // Longest first so "revenue growth" wins over "revenue" at the same place.
  candidates.sort((a, b) => (b.end - b.start) - (a.end - a.start));
  const taken: MetricHit[] = [];
  for (const candidate of candidates) {
    const overlaps = taken.some((t) => candidate.start < t.end && t.start < candidate.end);
    const duplicate = taken.some((t) => t.metric === candidate.metric);
    if (!overlaps && !duplicate) taken.push(candidate);
  }
  return taken.sort((a, b) => a.start - b.start);
}

interface NumberHit { value: number; start: number; end: number; ratio?: boolean }

const CLOCK = /^\d{1,2}:\d{2}$/;

/**
 * Numbers in the text.
 *
 * Ratios come first: "1:2.5" and "2.5:1" both mean a reward of 2.5 per unit of
 * risk, so either order reads as the larger over the smaller. A colon pair
 * with exactly two-digit minutes is a clock time ("09:30"), not a ratio, and
 * is ignored so a session window never becomes a threshold.
 */
function findNumbers(lower: string): NumberHit[] {
  const out: NumberHit[] = [];
  let masked = lower;

  const ratio = /(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/g;
  let r: RegExpExecArray | null;
  while ((r = ratio.exec(lower)) !== null) {
    if (CLOCK.test(r[0].replace(/\s+/g, ''))) continue;
    const a = Number(r[1]);
    const b = Number(r[2]);
    if (!(a > 0 && b > 0)) continue;
    out.push({ value: Math.max(a, b) / Math.min(a, b), start: r.index, end: r.index + r[0].length, ratio: true });
    masked = masked.slice(0, r.index) + ' '.repeat(r[0].length) + masked.slice(r.index + r[0].length);
  }

  masked = masked.replace(/\d{1,2}:\d{2}/g, (m) => ' '.repeat(m.length));
  const pattern = /-?\d+(?:\.\d+)?/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(masked)) !== null) {
    out.push({ value: Number(match[0]), start: match.index, end: match.index + match[0].length });
  }
  return out.sort((x, y) => x.start - y.start);
}

/**
 * "revenue and EPS above 15%" - the first metric carries no number of its own
 * but is joined to the next by nothing more than a conjunction, so the
 * threshold is shared rather than missing.
 */
function sharesThresholdWithNext(lower: string, hit: MetricHit, next: MetricHit | undefined): boolean {
  if (!next) return false;
  const between = lower.slice(hit.end, next.start);
  return /^[\s,]*(and|or|&|,)[\s]*$/.test(between);
}

/**
 * Whether the character at `i` ends a clause.
 *
 * A dot between two digits is a decimal point, not a full stop. Treating it as
 * one split "at least a 2.5 reward to risk" in the middle of the number, so the
 * threshold fell outside the clause and was never read.
 */
export function isClauseBreak(text: string, i: number): boolean {
  const ch = text[i];
  if (ch === ',' || ch === ';' || ch === '\n') return true;
  if (ch !== '.') return false;
  return !(/\d/.test(text[i - 1] ?? '') && /\d/.test(text[i + 1] ?? ''));
}

/** Index of the last clause break in `text`, or -1. */
export function lastClauseBreak(text: string): number {
  for (let i = text.length - 1; i >= 0; i -= 1) {
    if (isClauseBreak(text, i)) return i;
  }
  return -1;
}

/** Keeps only the text after the last clause break, where qualifiers apply. */
function trimToClause(text: string): string {
  const cut = lastClauseBreak(text);
  return cut === -1 ? text : text.slice(cut + 1);
}

/**
 * Whether the character at `i` ends a sentence. Same decimal rule as
 * isClauseBreak: "above 12.5x EV/EBITDA" split at the dot lost "above", and the
 * rule silently fell back to the metric's default direction — the opposite of
 * what was written.
 */
function isSentenceBreak(text: string, i: number, semicolonBreaks: boolean): boolean {
  const ch = text[i];
  if (ch === '\n') return true;
  if (ch === ';') return semicolonBreaks;
  if (ch !== '.') return false;
  return !(/\d/.test(text[i - 1] ?? '') && /\d/.test(text[i + 1] ?? ''));
}

function sentenceAround(lower: string, index: number): string {
  let start = 0;
  for (let i = Math.min(index, lower.length - 1); i >= 0; i -= 1) {
    if (isSentenceBreak(lower, i, true)) { start = i + 1; break; }
  }
  let end = lower.length;
  for (let i = index; i < lower.length; i += 1) {
    if (isSentenceBreak(lower, i, false)) { end = i; break; }
  }
  return lower.slice(start, end);
}

/** Phrases with no metric in them at all, so nothing is silently dropped. */
function findUnmatched(description: string, hits: MetricHit[]): string[] {
  const lower = description.toLowerCase();
  return description
    .split(/[\n;,]|\band\b|\bwith\b|\bplus\b/i)
    .map((part) => part.trim())
    .filter((part) => {
      if (part.length < 4) return false;
      const start = lower.indexOf(part.toLowerCase());
      const end = start + part.length;
      const covered = hits.some((h) => h.start >= start && h.end <= end);
      return !covered && /[a-z]{4}/i.test(part);
    });
}

/** Offered as starting points only; nothing is applied until the user picks. */
const SUGGESTIONS: Record<string, { label: string; value: string }[]> = {
  roic: [{ label: '10%', value: '10' }, { label: '15%', value: '15' }, { label: '20%', value: '20' }],
  roe: [{ label: '12%', value: '12' }, { label: '15%', value: '15' }, { label: '20%', value: '20' }],
  revenue_growth: [{ label: '10%', value: '10' }, { label: '15%', value: '15' }, { label: '20%', value: '20' }],
  eps_growth: [{ label: '10%', value: '10' }, { label: '15%', value: '15' }, { label: '20%', value: '20' }],
  debt_ebitda: [{ label: '1.0x', value: '1' }, { label: '2.0x', value: '2' }, { label: '3.0x', value: '3' }],
  forward_pe: [{ label: '20x', value: '20' }, { label: '25x', value: '25' }, { label: '35x', value: '35' }],
  rr: [{ label: '1.5', value: '1.5' }, { label: '2.0', value: '2' }, { label: '3.0', value: '3' }],
  risk_percent: [{ label: '0.5%', value: '0.5' }, { label: '1%', value: '1' }, { label: '2%', value: '2' }],
  rsi: [{ label: '30', value: '30' }, { label: '50', value: '50' }, { label: '70', value: '70' }],
};

function matchComparator(lower: string): ComparisonOperator | null {
  for (const { phrases, operator } of COMPARATORS) {
    // Whole words only. A substring test reads "under" inside "compounders"
    // and silently flips a rule's direction.
    if (phrases.some((phrase) => wordBoundary(phrase).test(lower))) return operator;
  }
  if (/[<>]=/.test(lower)) return lower.includes('>=') ? '>=' : '<=';
  if (/[<>]/.test(lower)) return lower.includes('>') ? '>' : '<';
  return null;
}

/** Without a stated direction, use whichever way the metric is normally better. */
function defaultOperator(preferred: 'higher' | 'lower' | undefined): ComparisonOperator {
  return preferred === 'lower' ? '<=' : '>=';
}

function parseNumber(lower: string): number | null {
  // Skip numbers that are part of a time, so "09:30" is not read as a threshold.
  const cleaned = lower.replace(/\d{1,2}:\d{2}/g, ' ');
  const match = /(-?\d+(?:\.\d+)?)\s*(%|x)?/.exec(cleaned);
  return match?.[1] !== undefined ? Number(match[1]) : null;
}

function matchTimeRange(lower: string): { start: string; end: string; timezone: string } | null {
  const match = /(\d{1,2}:\d{2})\s*(?:-|–|to|until)\s*(\d{1,2}:\d{2})/.exec(lower);
  if (!match?.[1] || !match[2]) return null;
  const timezone = /new york|ny|est|edt/.test(lower) ? 'America/New_York'
    : /london|gmt|bst/.test(lower) ? 'Europe/London'
    : /tokyo|jst/.test(lower) ? 'Asia/Tokyo'
    : /singapore|sgt/.test(lower) ? 'Asia/Singapore'
    : 'UTC';
  return { start: match[1], end: match[2], timezone };
}

const boundaryCache = new Map<string, RegExp>();
function wordBoundary(phrase: string): RegExp {
  let expression = boundaryCache.get(phrase);
  if (!expression) {
    expression = new RegExp(`(?<![a-z])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z])`, 'i');
    boundaryCache.set(phrase, expression);
  }
  return expression;
}

function symbol(operator: ComparisonOperator): string {
  return { '>=': '≥', '<=': '≤', '>': '>', '<': '<', '==': '=', '!=': '≠' }[operator];
}

function suggestName(description: string, mode: Mode): string {
  const lower = description.toLowerCase();
  if (mode === 'trading') {
    if (lower.includes('fvg')) return 'FVG strategy';
    if (lower.includes('breakout')) return 'Breakout strategy';
    if (lower.includes('rsi')) return 'RSI strategy';
    return 'Trading strategy';
  }
  if (lower.includes('dividend')) return 'Dividend';
  if (lower.includes('value')) return 'Value';
  if (lower.includes('quality') || lower.includes('roic')) return 'Quality growth';
  return 'Investment strategy';
}
