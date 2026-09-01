import type { ObservationSet } from '@/types/observations';
import type { MetricDef } from '@/types/metrics';

export interface CompanyRef {
  ticker: string;
  name: string;
  exchange?: string;
}

export interface CompanySnapshot extends CompanyRef {
  sector?: string;
  price?: number;
  currency?: string;
  /** Keyed by metric id. Anything the provider could not supply is simply absent. */
  observations: ObservationSet;
  providerName: string;
  isMock: boolean;
  warnings: string[];
}

export interface FinancialDataProvider {
  readonly name: string;
  /** True for demo providers. The UI must say so plainly. */
  readonly isMock: boolean;
  getSnapshot(ticker: string, requested: MetricDef[]): Promise<CompanySnapshot>;
  search(query: string): Promise<CompanyRef[]>;
}

export class FinancialDataUnavailableError extends Error {
  constructor(message: string, readonly retryable = false) {
    super(message);
    this.name = 'FinancialDataUnavailableError';
  }
}
