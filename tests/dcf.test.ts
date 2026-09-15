import { describe, it, expect } from 'vitest';
import { computeDcf, validateDcf, type DcfInput, type DcfResult } from '@/lib/calculations/dcf';

const base: DcfInput = {
  freeCashFlow: 100,
  growthPercent: 10,
  terminalGrowthPercent: 2,
  discountPercent: 8,
  years: 5,
  sharesOutstanding: 50,
  netCash: 0,
};

function result(input: DcfInput = base): DcfResult {
  const out = computeDcf(input);
  if ('problem' in out) throw new Error(out.problem);
  return out;
}

describe('discounted cash flow', () => {
  it('discounts each forecast year at the required return', () => {
    const r = result();
    // Year 1: 110 / 1.08 = 101.85
    expect(r.years[0]?.cashFlow).toBeCloseTo(110, 6);
    expect(r.years[0]?.presentValue).toBeCloseTo(110 / 1.08, 6);
    // Year 5: 100 × 1.1^5 / 1.08^5
    expect(r.years[4]?.presentValue).toBeCloseTo((100 * 1.1 ** 5) / 1.08 ** 5, 6);
    expect(r.years).toHaveLength(5);
  });

  it('applies Gordon growth to the year after the forecast', () => {
    const r = result();
    const year5 = 100 * 1.1 ** 5;
    const terminal = (year5 * 1.02) / (0.08 - 0.02);
    expect(r.terminalValue).toBeCloseTo(terminal, 6);
    expect(r.presentValueOfTerminal).toBeCloseTo(terminal / 1.08 ** 5, 6);
  });

  it('sums to enterprise value, adjusts for net cash, divides by shares', () => {
    const r = result({ ...base, netCash: 200 });
    expect(r.enterpriseValue).toBeCloseTo(r.presentValueOfForecast + r.presentValueOfTerminal, 6);
    expect(r.equityValue).toBeCloseTo(r.enterpriseValue + 200, 6);
    expect(r.perShare).toBeCloseTo(r.equityValue / 50, 6);
  });

  it('net debt reduces equity value', () => {
    expect(result({ ...base, netCash: -300 }).equityValue).toBeCloseTo(result().enterpriseValue - 300, 6);
  });

  it('reports the implied difference against a price, or null without one', () => {
    const r = result({ ...base, price: 40 });
    expect(r.impliedDifferencePercent).toBeCloseTo(((r.perShare - 40) / 40) * 100, 6);
    expect(result({ ...base, price: null }).impliedDifferencePercent).toBeNull();
    expect(result({ ...base, price: 0 }).impliedDifferencePercent).toBeNull();
  });

  it('shows how much of the value rests on the terminal assumption', () => {
    const r = result();
    expect(r.terminalShare).toBeGreaterThan(50); // most of a 5-year DCF usually does
    expect(r.terminalShare).toBeLessThan(100);
  });

  it('refuses a terminal growth at or above the discount rate rather than returning infinity', () => {
    expect(validateDcf({ ...base, terminalGrowthPercent: 8 })).toBe('terminal_growth_not_below_discount');
    expect(validateDcf({ ...base, terminalGrowthPercent: 9 })).toBe('terminal_growth_not_below_discount');
    expect(computeDcf({ ...base, terminalGrowthPercent: 8 })).toEqual({ problem: 'terminal_growth_not_below_discount' });
  });

  it('refuses inputs that make the model undefined', () => {
    expect(validateDcf({ ...base, sharesOutstanding: 0 })).toBe('non_positive_shares');
    expect(validateDcf({ ...base, years: 0 })).toBe('years_out_of_range');
    expect(validateDcf({ ...base, years: 31 })).toBe('years_out_of_range');
    expect(validateDcf({ ...base, years: 2.5 })).toBe('years_out_of_range');
    expect(validateDcf({ ...base, freeCashFlow: NaN })).toBe('non_finite_input');
  });

  it('handles negative free cash flow without inventing a positive value', () => {
    const r = result({ ...base, freeCashFlow: -100 });
    expect(r.perShare).toBeLessThan(0);
  });

  it('is deterministic', () => {
    expect(result()).toEqual(result());
  });
});
