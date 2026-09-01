import type { Strategy, StrategyVersion, StrategyMeta, Rule, Mode } from '@/types/rules';

export interface StrategyWithVersion {
  strategy: Strategy;
  version: StrategyVersion;
}

export interface CreateStrategyInput {
  name: string;
  mode: Mode;
  description?: string;
  rules: Rule[];
  meta?: StrategyMeta;
}

export interface UpdateStrategyInput {
  name?: string;
  description?: string;
  rules?: Rule[];
  meta?: StrategyMeta;
}

/**
 * The only way the application reads or writes strategies.
 *
 * Phase 2 ships a browser-local implementation. Phase 6 swaps in a Postgres
 * implementation behind this same interface; no feature code changes.
 */
export interface StrategyRepository {
  list(): Promise<StrategyWithVersion[]>;
  get(id: string): Promise<StrategyWithVersion | null>;
  getVersion(versionId: string): Promise<StrategyVersion | null>;
  create(input: CreateStrategyInput): Promise<StrategyWithVersion>;
  /** Changing rules or meta creates a NEW immutable version; renaming does not. */
  update(id: string, input: UpdateStrategyInput): Promise<StrategyWithVersion>;
  duplicate(id: string): Promise<StrategyWithVersion>;
  setStatus(id: string, status: Strategy['status']): Promise<StrategyWithVersion>;
  remove(id: string): Promise<void>;
}
