import type { Rule, Mode, StrategyMeta } from '@/types/rules';

/**
 * A gap the parser refuses to fill in for you.
 *
 * "ROIC above 15" is a rule. "Good ROIC" is a question. Guessing a threshold
 * would be the same mistake as assuming an unobserved fact is true: the number
 * would look authoritative and would not be yours.
 */
export interface ParseQuestion {
  id: string;
  /** Metric the answer completes. */
  metric: string;
  /** What the user actually wrote that triggered this. */
  quote?: string;
  question: string;
  kind: 'threshold' | 'direction' | 'requirement' | 'session';
  /** Offered starting points. Never applied without an answer. */
  suggestions?: { label: string; value: string }[];
  unit?: string;
}

export interface ParseResult {
  mode: Mode;
  /** Rules the description stated unambiguously. */
  rules: Rule[];
  /** Everything the description implied but did not pin down. */
  questions: ParseQuestion[];
  /** Phrases no metric matched, surfaced so nothing is silently dropped. */
  unmatched: string[];
  meta: StrategyMeta;
  suggestedName?: string;
  parserName: string;
  isMock: boolean;
}

export interface StrategyParser {
  readonly name: string;
  /** True when this is the built-in pattern parser rather than a model. */
  readonly isMock: boolean;
  parse(input: {
    description: string;
    mode: Mode;
    /** Answers to questions from a previous pass, keyed by question id. */
    answers?: Record<string, string>;
  }): Promise<ParseResult>;
}
