import type { Portfolio, Position, PortfolioReview, Violation } from './types';
import { EPSILON } from '@/lib/calculations/units';

export const CASH = 'CASH';

const pct = (n: number) => `${Number(n.toFixed(2))}%`;

function isCash(position: Position): boolean {
  return position.ticker.trim().toUpperCase() === CASH;
}

/**
 * Measures holdings against the portfolio's own limits.
 *
 * Pure arithmetic over the positions as given. A rule with no limit set is
 * skipped, never assumed. Unknown sectors cannot contribute to a sector
 * breach, so they are surfaced as a note rather than silently ignored.
 */
export function reviewPortfolio(portfolio: Portfolio): PortfolioReview {
  const { positions, limits } = portfolio;
  const violations: Violation[] = [];

  const cashWeight = positions.filter(isCash).reduce((s, p) => s + p.weight, 0);
  const holdings = positions.filter((p) => !isCash(p));
  const investedWeight = holdings.reduce((s, p) => s + p.weight, 0);
  const total = cashWeight + investedWeight;

  // Weights that do not add to 100% make every other percentage misleading.
  if (Math.abs(total - 100) > 0.5) {
    violations.push({
      kind: 'weights_total',
      severity: 'note',
      message: `Weights add to ${pct(total)}, not 100%. Other figures are read against what was entered.`,
      limit: '100%',
      actual: pct(total),
      subjects: [],
    });
  }

  if (limits.maxSinglePosition !== undefined) {
    for (const p of holdings) {
      if (p.weight - limits.maxSinglePosition > EPSILON) {
        violations.push({
          kind: 'single_position',
          severity: 'breach',
          message: `${p.ticker} is ${pct(p.weight)} of the portfolio; the limit is ${pct(limits.maxSinglePosition)}.`,
          limit: pct(limits.maxSinglePosition),
          actual: pct(p.weight),
          subjects: [p.ticker],
        });
      }
    }
  }

  // Sector exposure. Unknown sectors are grouped and reported, not guessed.
  const bySector = new Map<string, { weight: number; tickers: string[] }>();
  for (const p of holdings) {
    const key = p.sector?.trim() || 'Unknown';
    const entry = bySector.get(key) ?? { weight: 0, tickers: [] };
    entry.weight += p.weight;
    entry.tickers.push(p.ticker);
    bySector.set(key, entry);
  }
  const sectors = [...bySector.entries()]
    .map(([sector, v]) => ({ sector, weight: v.weight, tickers: v.tickers }))
    .sort((a, b) => b.weight - a.weight);

  if (limits.maxSectorExposure !== undefined) {
    for (const s of sectors) {
      if (s.sector === 'Unknown') continue;
      if (s.weight - limits.maxSectorExposure > EPSILON) {
        violations.push({
          kind: 'sector_exposure',
          severity: 'breach',
          message: `${s.sector} exposure is ${pct(s.weight)}; the limit is ${pct(limits.maxSectorExposure)}.`,
          limit: pct(limits.maxSectorExposure),
          actual: pct(s.weight),
          subjects: s.tickers,
        });
      }
    }
    const unknown = bySector.get('Unknown');
    if (unknown && unknown.weight > EPSILON) {
      violations.push({
        kind: 'unknown_sector',
        severity: 'note',
        message: `${pct(unknown.weight)} of the portfolio has no sector, so it could not be checked against the sector limit.`,
        limit: pct(limits.maxSectorExposure),
        actual: 'unknown',
        subjects: unknown.tickers,
      });
    }
  }

  if (limits.minCash !== undefined && limits.minCash - cashWeight > EPSILON) {
    violations.push({
      kind: 'min_cash',
      severity: 'breach',
      message: `Cash is ${pct(cashWeight)}; the minimum is ${pct(limits.minCash)}.`,
      limit: `≥ ${pct(limits.minCash)}`,
      actual: pct(cashWeight),
      subjects: [CASH],
    });
  }

  const count = holdings.length;
  if (limits.minPositions !== undefined && count < limits.minPositions) {
    violations.push({
      kind: 'position_count', severity: 'breach',
      message: `${count} position${count === 1 ? '' : 's'} held; the minimum is ${limits.minPositions}.`,
      limit: `≥ ${limits.minPositions}`, actual: String(count), subjects: holdings.map((p) => p.ticker),
    });
  }
  if (limits.maxPositions !== undefined && count > limits.maxPositions) {
    violations.push({
      kind: 'position_count', severity: 'breach',
      message: `${count} positions held; the maximum is ${limits.maxPositions}.`,
      limit: `≤ ${limits.maxPositions}`, actual: String(count), subjects: holdings.map((p) => p.ticker),
    });
  }

  return {
    violations,
    sectors,
    cashWeight,
    investedWeight,
    positionCount: count,
    compliant: violations.every((v) => v.severity !== 'breach'),
  };
}
