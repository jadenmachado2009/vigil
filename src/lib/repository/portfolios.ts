import type { Portfolio } from '@/lib/portfolio/types';
import type { KeyValueStore } from './local';

const STORAGE_KEY = 'vigil.portfolio.v1';

/**
 * One portfolio per user for now. The spec's "My Portfolio" is singular, and a
 * second one is a repository change, not a product change.
 */
export interface PortfolioRepository {
  get(): Promise<Portfolio | null>;
  save(portfolio: Portfolio): Promise<Portfolio>;
}

export class LocalPortfolioRepository implements PortfolioRepository {
  constructor(private readonly injected?: KeyValueStore) {}

  private backend(): KeyValueStore | null {
    if (this.injected) return this.injected;
    return typeof window === 'undefined' ? null : window.localStorage;
  }

  async get(): Promise<Portfolio | null> {
    const store = this.backend();
    if (!store) return null;
    try {
      const raw = store.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Portfolio) : null;
    } catch {
      return null;
    }
  }

  async save(portfolio: Portfolio): Promise<Portfolio> {
    this.backend()?.setItem(STORAGE_KEY, JSON.stringify(portfolio));
    return portfolio;
  }
}
