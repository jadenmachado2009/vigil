import type { AnalysisRecord } from '@/types/analysis';
import { isClosed } from '@/lib/calculations/outcome';

/**
 * Performance statistics over recorded outcomes.
 *
 * Two rules govern everything here:
 *
 *  1. Only CLOSED positions with a derived R multiple count. An open trade has
 *     no result yet, and counting it would let a running position flatter the
 *     record.
 *  2. Below a usable sample, figures are reported with `sufficient: false`
 *     rather than dressed up. A 100% win rate over two trades is not a win
 *     rate, and presenting it as one is the same failure as assuming an
 *     unobserved fact is true.
 */
export const MIN_SAMPLE = 20;

export interface TradeStatistics {
  /** Closed positions with a settled R multiple. */
  trades: number;
  wins: number;
  losses: number;
  breakevens: number;
  /** Positions checked but deliberately not taken. */
  notTaken: number;
  open: number;
  winRate: number | null;
  averageR: number | null;
  /** Mean R per trade. The number that decides whether the edge is real. */
  expectancy: number | null;
  /** Gross R won divided by gross R lost. Null when nothing has been lost. */
  profitFactor: number | null;
  averageWinner: number | null;
  averageLoser: number | null;
  largestWinner: number | null;
  largestLoser: number | null;
  totalR: number;
  /** Deepest peak-to-trough decline of cumulative R, as a positive number. */
  maxDrawdown: number;
  /** False when the sample is too small to read the rates as meaningful. */
  sufficient: boolean;
  sampleShortfall: number;
}

function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

/** Closed trades, oldest first, with their settled R multiples. */
export function settledTrades(records: AnalysisRecord[]): { record: AnalysisRecord; r: number }[] {
  return records
    .filter((record) => {
      const o = record.outcome;
      return o?.kind === 'trade' && isClosed(o.status) && typeof o.rMultiple === 'number';
    })
    .map((record) => ({ record, r: (record.outcome as { rMultiple: number }).rMultiple }))
    .sort((a, b) => a.record.createdAt.localeCompare(b.record.createdAt));
}

/**
 * Deepest decline from a running peak of cumulative R. Returned as a positive
 * magnitude; zero when the curve never gave anything back.
 */
export function maxDrawdown(rSeries: number[]): number {
  let cumulative = 0;
  let peak = 0;
  let deepest = 0;
  for (const r of rSeries) {
    cumulative += r;
    if (cumulative > peak) peak = cumulative;
    const decline = peak - cumulative;
    if (decline > deepest) deepest = decline;
  }
  return deepest;
}

export function computeTradeStatistics(records: AnalysisRecord[]): TradeStatistics {
  const settled = settledTrades(records);
  const rs = settled.map((s) => s.r);

  const winners = rs.filter((r) => r > 0);
  const losers = rs.filter((r) => r < 0);
  const breakevens = rs.filter((r) => r === 0).length;

  const grossWin = winners.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losers.reduce((a, b) => a + b, 0));

  const trades = rs.length;
  const notTaken = records.filter((r) => r.outcome?.kind === 'trade' && r.outcome.status === 'NOT_TAKEN').length;
  const open = records.filter((r) => r.outcome?.kind === 'trade' && r.outcome.status === 'OPEN').length;

  return {
    trades,
    wins: winners.length,
    losses: losers.length,
    breakevens,
    notTaken,
    open,
    winRate: trades === 0 ? null : (winners.length / trades) * 100,
    averageR: mean(rs),
    expectancy: mean(rs),
    // Undefined rather than infinite when nothing has been lost yet.
    profitFactor: grossLoss === 0 ? null : grossWin / grossLoss,
    averageWinner: mean(winners),
    averageLoser: mean(losers),
    largestWinner: winners.length === 0 ? null : Math.max(...winners),
    largestLoser: losers.length === 0 ? null : Math.min(...losers),
    totalR: rs.reduce((a, b) => a + b, 0),
    maxDrawdown: maxDrawdown(rs),
    sufficient: trades >= MIN_SAMPLE,
    sampleShortfall: Math.max(0, MIN_SAMPLE - trades),
  };
}

export interface InvestmentStatistics {
  analysed: number;
  bought: number;
  holding: number;
  sold: number;
  notBought: number;
  averageReturn: number | null;
  bestReturn: number | null;
  worstReturn: number | null;
  sufficient: boolean;
}

export function computeInvestmentStatistics(records: AnalysisRecord[]): InvestmentStatistics {
  const investments = records.filter((r) => r.outcome?.kind === 'investment');
  const status = (s: string) => investments.filter((r) => r.outcome?.status === s).length;
  const returns = investments
    .map((r) => (r.outcome?.kind === 'investment' ? r.outcome.returnPercent : null))
    .filter((v): v is number => typeof v === 'number');

  return {
    analysed: records.filter((r) => r.mode === 'investing').length,
    bought: status('BOUGHT'),
    holding: status('HOLDING'),
    sold: status('SOLD'),
    notBought: status('NOT_BOUGHT'),
    averageReturn: mean(returns),
    bestReturn: returns.length === 0 ? null : Math.max(...returns),
    worstReturn: returns.length === 0 ? null : Math.min(...returns),
    sufficient: returns.length >= 5,
  };
}

/** Per-strategy breakdown, so one strategy's record cannot hide inside another's. */
export function byStrategy(records: AnalysisRecord[]): { name: string; stats: TradeStatistics }[] {
  const groups = new Map<string, AnalysisRecord[]>();
  for (const record of records) {
    const list = groups.get(record.strategyName) ?? [];
    list.push(record);
    groups.set(record.strategyName, list);
  }
  return [...groups.entries()]
    .map(([name, group]) => ({ name, stats: computeTradeStatistics(group) }))
    .filter((entry) => entry.stats.trades > 0)
    .sort((a, b) => b.stats.totalR - a.stats.totalR);
}
