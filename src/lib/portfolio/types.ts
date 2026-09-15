/**
 * Portfolio rules (spec section 15).
 *
 * Same principle as the strategy engine: the user writes the limits, code
 * measures the holdings against them, and a breach is reported as a violation
 * with the numbers that produced it. Nothing here suggests what to buy or sell.
 */

export interface Position {
  ticker: string;
  /** Percent of the portfolio, e.g. 25 for 25%. */
  weight: number;
  /** GICS-style sector. Unknown is allowed and reported as such. */
  sector?: string;
}

export interface PortfolioLimits {
  /** Largest weight any single position may have, percent. */
  maxSinglePosition?: number;
  /** Largest combined weight of one sector, percent. */
  maxSectorExposure?: number;
  /** Smallest weight the cash line may have, percent. */
  minCash?: number;
  /** Fewest positions, excluding cash. */
  minPositions?: number;
  /** Most positions, excluding cash. */
  maxPositions?: number;
}

export interface Portfolio {
  id: string;
  name: string;
  positions: Position[];
  limits: PortfolioLimits;
  updatedAt: string;
}

export type ViolationKind =
  | 'single_position'
  | 'sector_exposure'
  | 'min_cash'
  | 'position_count'
  | 'weights_total'
  | 'unknown_sector';

export interface Violation {
  kind: ViolationKind;
  /** Plain statement of what is out of bounds. */
  message: string;
  /** What the limit says, formatted. */
  limit: string;
  /** What the holdings actually are, formatted. */
  actual: string;
  /** Positions or sector responsible. */
  subjects: string[];
  /** Advisory notes do not count as breaches. */
  severity: 'breach' | 'note';
}

export interface PortfolioReview {
  violations: Violation[];
  /** Combined weight per sector, descending. */
  sectors: { sector: string; weight: number; tickers: string[] }[];
  cashWeight: number;
  investedWeight: number;
  positionCount: number;
  /** True when no breach was found. Notes may still be present. */
  compliant: boolean;
}
