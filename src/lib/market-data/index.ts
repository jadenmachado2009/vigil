import type { FinancialDataProvider } from './types';
import { MockFinancialProvider } from './mock-financial';
import { FmpFinancialProvider } from './fmp';

export * from './types';
export { MockFinancialProvider } from './mock-financial';
export { FmpFinancialProvider } from './fmp';

/**
 * Chooses the fundamentals provider from the environment. Server-side only.
 * Falls back to the labelled demo provider when a real one is not configured.
 */
export function getFinancialProvider(): FinancialDataProvider {
  const choice = (process.env['FINANCIAL_PROVIDER'] ?? 'mock').toLowerCase();
  if (choice === 'fmp') {
    const key = process.env['FMP_API_KEY'];
    if (key) return new FmpFinancialProvider(key);
  }
  return new MockFinancialProvider();
}
