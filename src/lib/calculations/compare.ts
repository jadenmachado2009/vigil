import type { ComparisonOperator } from '@/types/rules.js';
import { EPSILON } from './units.js';

/**
 * Epsilon-aware numeric comparison. All threshold checks in the product route
 * through here so that float representation can never flip a verdict.
 */
export function compareNumbers(
  actual: number,
  operator: ComparisonOperator,
  expected: number,
): boolean {
  const diff = actual - expected;
  switch (operator) {
    case '>=': return diff >= -EPSILON;
    case '<=': return diff <= EPSILON;
    case '>':  return diff > EPSILON;
    case '<':  return diff < -EPSILON;
    case '==': return Math.abs(diff) <= EPSILON;
    case '!=': return Math.abs(diff) > EPSILON;
  }
}

export function operatorLabel(operator: ComparisonOperator): string {
  return { '>=': '≥', '<=': '≤', '>': '>', '<': '<', '==': '=', '!=': '≠' }[operator];
}
