import type { StrategyParser } from './types';
import { PatternStrategyParser } from './pattern-parser';
import { GeminiStrategyParser } from './gemini-parser';

export * from './types';
export { PatternStrategyParser } from './pattern-parser';
export { GeminiStrategyParser } from './gemini-parser';

/**
 * The built-in pattern parser is the default and costs nothing. A model parser
 * is used only when explicitly configured, and falls back on failure - a parse
 * that half-works beats an error page in front of the strategy builder.
 */
export function getStrategyParser(): { primary: StrategyParser; fallback: StrategyParser } {
  const fallback = new PatternStrategyParser();
  const choice = (process.env['STRATEGY_PARSER'] ?? 'pattern').toLowerCase();
  if (choice === 'gemini') {
    const key = process.env['GEMINI_API_KEY'];
    if (key) return { primary: new GeminiStrategyParser(key), fallback };
  }
  return { primary: fallback, fallback };
}
