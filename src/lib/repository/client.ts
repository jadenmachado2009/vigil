'use client';

import type { Strategy, StrategyVersion } from '@/types/rules';
import type { AnalysisRecord, Outcome } from '@/types/analysis';
import type {
  StrategyRepository, StrategyWithVersion, CreateStrategyInput, UpdateStrategyInput,
} from './types';
import { LocalStrategyRepository } from './local';
import { LocalAnalysisRepository, type AnalysisRepository } from './analyses';
import { LocalPortfolioRepository, type PortfolioRepository } from './portfolios';
import type { Portfolio } from '@/lib/portfolio/types';

/**
 * Storage selection.
 *
 * Signed in  → the account's Postgres data, over the API.
 * Signed out → this browser only.
 *
 * Both sides implement the same interfaces, so no feature code knows which is
 * in use. The app stays fully usable without an account, which is deliberate:
 * requiring a signup to try a decision tool is a bad trade.
 */
export interface Account {
  signedIn: boolean;
  email: string | null;
  name: string | null;
  /** False when the deployment has no database, so accounts cannot exist. */
  accountsAvailable: boolean;
}

const SIGNED_OUT: Account = { signedIn: false, email: null, name: null, accountsAvailable: false };

/**
 * One source of truth for who is signed in.
 *
 * Both the storage selection and the account badge read this. When they each
 * kept their own copy, a sign-in could update one and not the other: the badge
 * went on saying "held in this browser" while writes were correctly going to
 * the account.
 */
let accountState: Promise<Account> | null = null;

export function getAccount(): Promise<Account> {
  accountState ??= fetch('/api/me')
    .then((r) => (r.ok ? (r.json() as Promise<Account>) : SIGNED_OUT))
    .catch(() => SIGNED_OUT);
  return accountState;
}

export async function isSignedIn(): Promise<boolean> {
  return (await getAccount()).signedIn;
}

/** Call after sign-in or sign-out so the next read goes to the right place. */
export function resetAccountState(): void {
  accountState = null;
}

export class SessionEndedError extends Error {
  constructor() {
    super('Your session ended. Sign in again — this was not saved to your account.');
    this.name = 'SessionEndedError';
  }
}

async function json<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    // The app believed it was signed in and the server disagrees. Falling back
    // to browser storage here would put the work somewhere the user is not
    // looking, so this surfaces instead.
    resetAccountState();
    throw new SessionEndedError();
  }
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? `Request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

class ApiStrategyRepository implements StrategyRepository {
  async list(): Promise<StrategyWithVersion[]> {
    return (await json<{ strategies: StrategyWithVersion[] }>(await fetch('/api/strategies'))).strategies;
  }
  async get(id: string): Promise<StrategyWithVersion | null> {
    const response = await fetch(`/api/strategies/${id}`);
    if (response.status === 404) return null;
    return (await json<{ strategy: StrategyWithVersion }>(response)).strategy;
  }
  async getVersion(versionId: string): Promise<StrategyVersion | null> {
    const response = await fetch(`/api/strategies/versions/${versionId}`);
    if (response.status === 404) return null;
    return (await json<{ version: StrategyVersion }>(response)).version;
  }
  async create(input: CreateStrategyInput): Promise<StrategyWithVersion> {
    return (await json<{ strategy: StrategyWithVersion }>(await fetch('/api/strategies', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    }))).strategy;
  }
  async update(id: string, input: UpdateStrategyInput): Promise<StrategyWithVersion> {
    return (await json<{ strategy: StrategyWithVersion }>(await fetch(`/api/strategies/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    }))).strategy;
  }
  async duplicate(id: string): Promise<StrategyWithVersion> {
    return (await json<{ strategy: StrategyWithVersion }>(
      await fetch(`/api/strategies/${id}/duplicate`, { method: 'POST' }),
    )).strategy;
  }
  async setStatus(id: string, status: Strategy['status']): Promise<StrategyWithVersion> {
    return (await json<{ strategy: StrategyWithVersion }>(await fetch(`/api/strategies/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    }))).strategy;
  }
  async remove(id: string): Promise<void> {
    await json(await fetch(`/api/strategies/${id}`, { method: 'DELETE' }));
  }
}

class ApiAnalysisRepository implements AnalysisRepository {
  async list(): Promise<AnalysisRecord[]> {
    return (await json<{ analyses: AnalysisRecord[] }>(await fetch('/api/analyses'))).analyses;
  }
  async get(id: string): Promise<AnalysisRecord | null> {
    return (await this.list()).find((a) => a.id === id) ?? null;
  }
  async save(record: AnalysisRecord): Promise<AnalysisRecord> {
    return (await json<{ analysis: AnalysisRecord }>(await fetch('/api/analyses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record),
    }))).analysis;
  }
  async setOutcome(id: string, outcome: Outcome | null): Promise<AnalysisRecord> {
    return (await json<{ analysis: AnalysisRecord }>(await fetch(`/api/analyses/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outcome }),
    }))).analysis;
  }

  async remove(id: string): Promise<void> {
    await json(await fetch(`/api/analyses/${id}`, { method: 'DELETE' }));
  }
}

class ApiPortfolioRepository implements PortfolioRepository {
  async get(): Promise<Portfolio | null> {
    return (await json<{ portfolio: Portfolio | null }>(await fetch('/api/portfolio'))).portfolio;
  }
  async save(portfolio: Portfolio): Promise<Portfolio> {
    return (await json<{ portfolio: Portfolio }>(await fetch('/api/portfolio', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(portfolio),
    }))).portfolio;
  }
}

const apiPortfolio = new ApiPortfolioRepository();
const localPortfolio = new LocalPortfolioRepository();

const apiStrategies = new ApiStrategyRepository();
const localStrategies = new LocalStrategyRepository();
const apiAnalyses = new ApiAnalysisRepository();
const localAnalyses = new LocalAnalysisRepository();

/**
 * Delegates each call to whichever backing store is active. Written as a proxy
 * rather than resolved once at module load because a user can sign in without
 * a full page reload.
 */
export const strategyRepository: StrategyRepository = {
  list: async () => (await isSignedIn() ? apiStrategies : localStrategies).list(),
  get: async (id) => (await isSignedIn() ? apiStrategies : localStrategies).get(id),
  getVersion: async (id) => (await isSignedIn() ? apiStrategies : localStrategies).getVersion(id),
  create: async (input) => (await isSignedIn() ? apiStrategies : localStrategies).create(input),
  update: async (id, input) => (await isSignedIn() ? apiStrategies : localStrategies).update(id, input),
  duplicate: async (id) => (await isSignedIn() ? apiStrategies : localStrategies).duplicate(id),
  setStatus: async (id, status) => (await isSignedIn() ? apiStrategies : localStrategies).setStatus(id, status),
  remove: async (id) => (await isSignedIn() ? apiStrategies : localStrategies).remove(id),
};

export const analysisRepository: AnalysisRepository = {
  list: async () => (await isSignedIn() ? apiAnalyses : localAnalyses).list(),
  get: async (id) => (await isSignedIn() ? apiAnalyses : localAnalyses).get(id),
  save: async (record) => (await isSignedIn() ? apiAnalyses : localAnalyses).save(record),
  setOutcome: async (id, outcome) => (await isSignedIn() ? apiAnalyses : localAnalyses).setOutcome(id, outcome),
  remove: async (id) => (await isSignedIn() ? apiAnalyses : localAnalyses).remove(id),
};

export const portfolioRepository: PortfolioRepository = {
  get: async () => (await isSignedIn() ? apiPortfolio : localPortfolio).get(),
  save: async (portfolio) => (await isSignedIn() ? apiPortfolio : localPortfolio).save(portfolio),
};

/** Copies anything saved in this browser into the signed-in account. */
export async function importLocalData(): Promise<{ strategies: number; analyses: number }> {
  const [localStrategyList, localAnalysisList] = await Promise.all([
    localStrategies.list(), localAnalyses.list(),
  ]);
  const idMap = new Map<string, string>();
  for (const { strategy, version } of localStrategyList) {
    const created = await apiStrategies.create({
      name: strategy.name,
      mode: strategy.mode,
      ...(strategy.description ? { description: strategy.description } : {}),
      rules: version.rules,
      ...(version.meta ? { meta: version.meta } : {}),
    });
    idMap.set(strategy.id, created.strategy.id);
    if (strategy.status !== 'active') await apiStrategies.setStatus(created.strategy.id, strategy.status);
  }
  for (const record of localAnalysisList) {
    await apiAnalyses.save({ ...record, strategyId: idMap.get(record.strategyId) ?? record.strategyId });
  }
  return { strategies: localStrategyList.length, analyses: localAnalysisList.length };
}
