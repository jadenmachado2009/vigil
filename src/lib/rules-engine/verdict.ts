import type { RuleResult, Verdict } from '@/types/results';

/**
 * Verdict resolution. Deterministic, order-dependent, and total.
 *
 * Precedence, highest first:
 *
 *  1. REJECTED          - a mandatory rule definitively failed and its policy is
 *                         `reject`. A definite failure is dispositive: no amount
 *                         of additional data can rescue the opportunity, so this
 *                         outranks missing data.
 *  2. INSUFFICIENT_DATA - a mandatory rule could not be determined. The system
 *                         refuses to guess.
 *  3. WATCH             - nothing has definitively failed, but a mandatory rule
 *                         is unconfirmed, or failed under a `watch` policy.
 *  4. QUALIFIED         - every mandatory rule passed.
 *
 * Optional rules never influence the verdict.
 */
export function resolveVerdict(results: RuleResult[]): { verdict: Verdict; reason: string } {
  const mandatory = results.filter((r) => r.mandatory);

  if (mandatory.length === 0) {
    return {
      verdict: 'INSUFFICIENT_DATA',
      reason: 'This strategy has no mandatory rules, so compliance cannot be determined.',
    };
  }

  const rejecting = mandatory.filter((r) => r.status === 'FAIL' && r.onFail === 'reject');
  if (rejecting.length > 0) {
    return {
      verdict: 'REJECTED',
      reason: `${rejecting.length} mandatory rule${rejecting.length > 1 ? 's' : ''} failed: ${rejecting.map((r) => r.label).join('; ')}.`,
    };
  }

  const unknown = mandatory.filter((r) => r.status === 'UNKNOWN');
  if (unknown.length > 0) {
    return {
      verdict: 'INSUFFICIENT_DATA',
      reason: `${unknown.length} mandatory rule${unknown.length > 1 ? 's' : ''} could not be verified: ${unknown.map((r) => r.label).join('; ')}. Nothing was assumed to pass.`,
    };
  }

  const watching = mandatory.filter(
    (r) => r.status === 'UNCONFIRMED' || (r.status === 'FAIL' && r.onFail === 'watch'),
  );
  if (watching.length > 0) {
    return {
      verdict: 'WATCH',
      reason: `No mandatory rule has definitively failed, but ${watching.length} is not yet satisfied: ${watching.map((r) => r.label).join('; ')}.`,
    };
  }

  return {
    verdict: 'QUALIFIED',
    reason: `All ${mandatory.length} mandatory rules passed. This describes compliance with your strategy, not a prediction of returns.`,
  };
}
