/**
 * Display formatting for figures.
 *
 * Derived values carry binary float noise - 1.1642 - 1.1610 is
 * 0.0031999999999999806 - which must never reach the screen. Values stay exact
 * in the engine and are rounded only here, at the boundary.
 *
 * Precision adapts to magnitude so a forex level keeps its pips and an index
 * level does not grow a false tail.
 */
export function formatFigure(value: number, maxDecimals = 6): string {
  if (!Number.isFinite(value)) return '—';
  const magnitude = Math.abs(value);
  const decimals =
    magnitude === 0 ? 0
    : magnitude >= 1000 ? 2
    : magnitude >= 1 ? 4
    : Math.min(maxDecimals, 6);
  // toFixed then strip trailing zeros: keeps 1.5 as "1.5", not "1.5000".
  return Number(value.toFixed(decimals)).toString();
}

export function formatMultiple(value: number): string {
  return `${Number(value.toFixed(2))}x`;
}

export function formatPercent(value: number, decimals = 1): string {
  return `${Number(value.toFixed(decimals))}%`;
}
