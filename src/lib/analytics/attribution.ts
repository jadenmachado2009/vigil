import type { AnalysisRecord } from '@/types/analysis';
import { computeTradeStatistics, settledTrades, type TradeStatistics } from './statistics';

/**
 * Rule attribution: how closed trades performed when a condition held, against
 * how they performed when it did not.
 *
 * Three decisions make this honest rather than flattering:
 *
 *  1. Grouping is by METRIC, not rule id. Rule ids are minted per strategy
 *     version, so grouping by id would split one condition's history into
 *     fragments every time the strategy was edited.
 *  2. A rule that could not be VERIFIED is excluded from both arms. "We do not
 *     know whether the condition held" is not the same as "the condition was
 *     absent", and folding one into the other invents evidence.
 *  3. Neither arm is reported as a rate until it has a usable sample. Two
 *     trades do not have a win rate.
 *
 * Nothing here establishes causation. It is a record of what happened
 * alongside a condition, and the interface must say so.
 */
export const MIN_ARM = 10;

export interface RuleAttribution {
  metric: string;
  label: string;
  /** Trades where the condition was observed to hold. */
  present: TradeStatistics;
  /** Trades where the condition was observed to be absent. */
  absent: TradeStatistics;
  /** Trades where the condition could not be verified, so neither arm claims them. */
  unverified: number;
  /** Expectancy difference, present minus absent. Null unless both arms qualify. */
  expectancyDelta: number | null;
  /** True when both arms carry enough trades to be worth comparing. */
  comparable: boolean;
}

export function computeRuleAttribution(records: AnalysisRecord[]): RuleAttribution[] {
  const settled = settledTrades(records).map((s) => s.record);

  const present = new Map<string, AnalysisRecord[]>();
  const absent = new Map<string, AnalysisRecord[]>();
  const unverified = new Map<string, number>();
  const labels = new Map<string, string>();

  for (const record of settled) {
    for (const result of record.results) {
      const metric = result.metric || result.label.trim().toLowerCase();
      labels.set(metric, result.label);
      if (result.status === 'PASS') {
        present.set(metric, [...(present.get(metric) ?? []), record]);
      } else if (result.status === 'FAIL') {
        absent.set(metric, [...(absent.get(metric) ?? []), record]);
      } else {
        // UNKNOWN or UNCONFIRMED. Attributing these would be inventing evidence.
        unverified.set(metric, (unverified.get(metric) ?? 0) + 1);
      }
    }
  }

  const metrics = new Set([...present.keys(), ...absent.keys(), ...unverified.keys()]);

  return [...metrics]
    .map((metric): RuleAttribution => {
      const withStats = computeTradeStatistics(present.get(metric) ?? []);
      const withoutStats = computeTradeStatistics(absent.get(metric) ?? []);
      const comparable = withStats.trades >= MIN_ARM && withoutStats.trades >= MIN_ARM;
      return {
        metric,
        label: labels.get(metric) ?? metric,
        present: withStats,
        absent: withoutStats,
        unverified: unverified.get(metric) ?? 0,
        expectancyDelta:
          comparable && withStats.expectancy !== null && withoutStats.expectancy !== null
            ? withStats.expectancy - withoutStats.expectancy
            : null,
        comparable,
      };
    })
    .sort((a, b) => {
      // Comparable rules first, then by how much evidence stands behind them.
      if (a.comparable !== b.comparable) return a.comparable ? -1 : 1;
      return (b.present.trades + b.absent.trades) - (a.present.trades + a.absent.trades);
    });
}
