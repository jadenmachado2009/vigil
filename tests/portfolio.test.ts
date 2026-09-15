import { describe, it, expect } from 'vitest';
import { reviewPortfolio } from '@/lib/portfolio/review';
import type { Portfolio } from '@/lib/portfolio/types';

function portfolio(positions: Portfolio['positions'], limits: Portfolio['limits'] = {}): Portfolio {
  return { id: 'p', name: 'Test', positions, limits, updatedAt: '2026-03-10T00:00:00.000Z' };
}

const spec = portfolio(
  [
    { ticker: 'NVDA', weight: 25, sector: 'Technology' },
    { ticker: 'MSFT', weight: 20, sector: 'Technology' },
    { ticker: 'GOOGL', weight: 15, sector: 'Technology' },
    { ticker: 'AMZN', weight: 15, sector: 'Technology' },
    { ticker: 'CASH', weight: 25 },
  ],
  { maxSinglePosition: 20, maxSectorExposure: 50, minCash: 10 },
);

describe('portfolio review', () => {
  it("reports the spec's example: technology exposure 75% against a 50% limit", () => {
    const review = reviewPortfolio(spec);
    const sector = review.violations.find((v) => v.kind === 'sector_exposure');
    expect(sector).toMatchObject({ severity: 'breach', actual: '75%', limit: '50%' });
    expect(sector?.subjects).toEqual(['NVDA', 'MSFT', 'GOOGL', 'AMZN']);
    expect(review.compliant).toBe(false);
  });

  it('flags a single position over its cap, and only that one', () => {
    const singles = reviewPortfolio(spec).violations.filter((v) => v.kind === 'single_position');
    expect(singles).toHaveLength(1);
    expect(singles[0]?.subjects).toEqual(['NVDA']);
    expect(singles[0]?.actual).toBe('25%');
  });

  it('passes the cash floor when cash meets it', () => {
    expect(reviewPortfolio(spec).violations.some((v) => v.kind === 'min_cash')).toBe(false);
  });

  it('breaches the cash floor when cash is short', () => {
    const p = portfolio([{ ticker: 'NVDA', weight: 95, sector: 'Technology' }, { ticker: 'CASH', weight: 5 }], { minCash: 10 });
    expect(reviewPortfolio(p).violations.find((v) => v.kind === 'min_cash')).toMatchObject({ actual: '5%', limit: '≥ 10%' });
  });

  it('is compliant when every limit holds', () => {
    const p = portfolio(
      [
        { ticker: 'NVDA', weight: 20, sector: 'Technology' },
        { ticker: 'JNJ', weight: 20, sector: 'Healthcare' },
        { ticker: 'KO', weight: 20, sector: 'Consumer Staples' },
        { ticker: 'V', weight: 20, sector: 'Financials' },
        { ticker: 'CASH', weight: 20 },
      ],
      { maxSinglePosition: 20, maxSectorExposure: 50, minCash: 10 },
    );
    const review = reviewPortfolio(p);
    expect(review.compliant).toBe(true);
    expect(review.violations).toHaveLength(0);
  });

  it('never assumes a limit that was not set', () => {
    const p = portfolio([{ ticker: 'NVDA', weight: 100, sector: 'Technology' }]);
    expect(reviewPortfolio(p).violations.filter((v) => v.severity === 'breach')).toHaveLength(0);
  });

  it('reports an unknown sector as a note rather than counting it or ignoring it', () => {
    const p = portfolio(
      [{ ticker: 'XYZ', weight: 60 }, { ticker: 'NVDA', weight: 40, sector: 'Technology' }],
      { maxSectorExposure: 50 },
    );
    const review = reviewPortfolio(p);
    expect(review.violations.find((v) => v.kind === 'sector_exposure')).toBeUndefined();
    expect(review.violations.find((v) => v.kind === 'unknown_sector')).toMatchObject({ severity: 'note', subjects: ['XYZ'] });
    expect(review.compliant).toBe(true);
  });

  it('notes weights that do not total 100%', () => {
    const p = portfolio([{ ticker: 'NVDA', weight: 30, sector: 'Technology' }, { ticker: 'CASH', weight: 30 }]);
    expect(reviewPortfolio(p).violations.find((v) => v.kind === 'weights_total')).toMatchObject({ severity: 'note', actual: '60%' });
  });

  it('treats a position exactly at the cap as within it', () => {
    const p = portfolio([{ ticker: 'NVDA', weight: 20, sector: 'Technology' }, { ticker: 'CASH', weight: 80 }], { maxSinglePosition: 20 });
    expect(reviewPortfolio(p).violations.some((v) => v.kind === 'single_position')).toBe(false);
  });

  it('checks position counts against both bounds', () => {
    const few = portfolio([{ ticker: 'NVDA', weight: 100, sector: 'Technology' }], { minPositions: 3 });
    expect(reviewPortfolio(few).violations.find((v) => v.kind === 'position_count')?.limit).toBe('≥ 3');
    const many = portfolio(
      ['A', 'B', 'C', 'D'].map((t) => ({ ticker: t, weight: 25, sector: 'X' })),
      { maxPositions: 3 },
    );
    expect(reviewPortfolio(many).violations.find((v) => v.kind === 'position_count')?.limit).toBe('≤ 3');
  });

  it('summarises sectors in descending order with cash separated', () => {
    const review = reviewPortfolio(spec);
    expect(review.sectors[0]).toMatchObject({ sector: 'Technology', weight: 75 });
    expect(review.cashWeight).toBe(25);
    expect(review.investedWeight).toBe(75);
    expect(review.positionCount).toBe(4);
  });
});
