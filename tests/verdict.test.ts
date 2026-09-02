import { describe, it, expect } from 'vitest';
import { resolveVerdict } from '@/lib/rules-engine/verdict';
import type { RuleResult, RuleStatus } from '@/types/results';

function r(
  status: RuleStatus,
  mandatory = true,
  onFail: 'reject' | 'watch' = 'reject',
  label: string = status,
): RuleResult {
  return { ruleId: label, metric: label, label, status, mandatory, onFail, expected: '', actual: null, reason: '' };
}

describe('verdict resolution', () => {
  it('QUALIFIED when every mandatory rule passes', () => {
    expect(resolveVerdict([r('PASS'), r('PASS'), r('FAIL', false)]).verdict).toBe('QUALIFIED');
  });

  it('REJECTED when a mandatory rule fails under a reject policy', () => {
    expect(resolveVerdict([r('PASS'), r('FAIL')]).verdict).toBe('REJECTED');
  });

  it('WATCH when a mandatory rule is unconfirmed', () => {
    expect(resolveVerdict([r('PASS'), r('UNCONFIRMED')]).verdict).toBe('WATCH');
  });

  it('WATCH when a mandatory rule fails under a watch policy', () => {
    expect(resolveVerdict([r('PASS'), r('FAIL', true, 'watch')]).verdict).toBe('WATCH');
  });

  it('INSUFFICIENT_DATA when a mandatory rule is unknown', () => {
    expect(resolveVerdict([r('PASS'), r('UNKNOWN')]).verdict).toBe('INSUFFICIENT_DATA');
  });

  it('a definite failure outranks missing data', () => {
    // More data cannot rescue an opportunity that has already broken a rule.
    expect(resolveVerdict([r('FAIL'), r('UNKNOWN')]).verdict).toBe('REJECTED');
  });

  it('missing data outranks an unconfirmed rule', () => {
    expect(resolveVerdict([r('UNKNOWN'), r('UNCONFIRMED')]).verdict).toBe('INSUFFICIENT_DATA');
  });

  it('optional rules never affect the verdict', () => {
    const results = [r('PASS'), r('FAIL', false), r('UNKNOWN', false), r('UNCONFIRMED', false)];
    expect(resolveVerdict(results).verdict).toBe('QUALIFIED');
  });

  it('a strategy with no mandatory rules cannot qualify', () => {
    expect(resolveVerdict([r('PASS', false)]).verdict).toBe('INSUFFICIENT_DATA');
  });

  it('every verdict is reachable', () => {
    const seen = new Set([
      resolveVerdict([r('PASS')]).verdict,
      resolveVerdict([r('FAIL')]).verdict,
      resolveVerdict([r('UNCONFIRMED')]).verdict,
      resolveVerdict([r('UNKNOWN')]).verdict,
    ]);
    expect(seen).toEqual(new Set(['QUALIFIED', 'REJECTED', 'WATCH', 'INSUFFICIENT_DATA']));
  });

  it('names the offending rules in its reason', () => {
    const out = resolveVerdict([r('FAIL', true, 'reject', 'Minimum RR 2.0')]);
    expect(out.reason).toContain('Minimum RR 2.0');
  });
});
