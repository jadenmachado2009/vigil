import type { Strategy, StrategyVersion } from '@/types/rules';
import type {
  StrategyRepository, StrategyWithVersion, CreateStrategyInput, UpdateStrategyInput,
} from './types';

const STORAGE_KEY = 'strategyai.v2';

interface Snapshot {
  strategies: Strategy[];
  versions: StrategyVersion[];
}

/** Minimal subset of the Storage API this adapter needs. Injectable for tests. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * A fresh snapshot every time. Returning a shared constant here - even spread -
 * would hand every caller the same mutable arrays, so one write would leak into
 * every later read (and, under server rendering, across requests).
 */
function emptySnapshot(): Snapshot {
  return { strategies: [], versions: [] };
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

/** Stable stringify for change detection, so renames do not create versions. */
function fingerprint(version: Pick<StrategyVersion, 'rules' | 'meta'>): string {
  return JSON.stringify({ rules: version.rules, meta: version.meta ?? {} });
}

/**
 * Browser-local persistence. Deliberately behind StrategyRepository so the
 * Postgres implementation in Phase 6 is a drop-in replacement.
 *
 * Reads are tolerant: a corrupt or absent store yields an empty snapshot rather
 * than throwing, so a bad write can never lock the user out of the app.
 */
export class LocalStrategyRepository implements StrategyRepository {
  constructor(private readonly injected?: KeyValueStore) {}

  /** Resolved per call so the adapter works whether or not a window exists yet. */
  private backend(): KeyValueStore | null {
    if (this.injected) return this.injected;
    return typeof window === 'undefined' ? null : window.localStorage;
  }

  private read(): Snapshot {
    const store = this.backend();
    if (!store) return emptySnapshot();
    try {
      const raw = store.getItem(STORAGE_KEY);
      if (!raw) return emptySnapshot();
      const parsed = JSON.parse(raw) as Partial<Snapshot>;
      return {
        strategies: Array.isArray(parsed.strategies) ? parsed.strategies : [],
        versions: Array.isArray(parsed.versions) ? parsed.versions : [],
      };
    } catch {
      return emptySnapshot();
    }
  }

  private write(snapshot: Snapshot): void {
    this.backend()?.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }

  private hydrate(snapshot: Snapshot, strategy: Strategy): StrategyWithVersion | null {
    const version = snapshot.versions.find((v) => v.id === strategy.currentVersionId);
    return version ? { strategy, version } : null;
  }

  async list(): Promise<StrategyWithVersion[]> {
    const snapshot = this.read();
    return snapshot.strategies
      .map((s) => this.hydrate(snapshot, s))
      .filter((x): x is StrategyWithVersion => x !== null)
      .sort((a, b) => b.strategy.updatedAt.localeCompare(a.strategy.updatedAt));
  }

  async get(id: string): Promise<StrategyWithVersion | null> {
    const snapshot = this.read();
    const strategy = snapshot.strategies.find((s) => s.id === id);
    return strategy ? this.hydrate(snapshot, strategy) : null;
  }

  async getVersion(versionId: string): Promise<StrategyVersion | null> {
    return this.read().versions.find((v) => v.id === versionId) ?? null;
  }

  async create(input: CreateStrategyInput): Promise<StrategyWithVersion> {
    const snapshot = this.read();
    const now = new Date().toISOString();
    const strategyId = uid('str');
    const version: StrategyVersion = {
      id: uid('ver'),
      strategyId,
      version: 1,
      mode: input.mode,
      rules: input.rules,
      ...(input.meta ? { meta: input.meta } : {}),
      createdAt: now,
    };
    const strategy: Strategy = {
      id: strategyId,
      name: input.name,
      mode: input.mode,
      ...(input.description ? { description: input.description } : {}),
      currentVersionId: version.id,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    snapshot.strategies.push(strategy);
    snapshot.versions.push(version);
    this.write(snapshot);
    return { strategy, version };
  }

  async update(id: string, input: UpdateStrategyInput): Promise<StrategyWithVersion> {
    const snapshot = this.read();
    const strategy = snapshot.strategies.find((s) => s.id === id);
    if (!strategy) throw new Error(`Strategy ${id} not found`);
    const current = snapshot.versions.find((v) => v.id === strategy.currentVersionId);
    if (!current) throw new Error(`Version for strategy ${id} not found`);

    if (input.name !== undefined) strategy.name = input.name;
    if (input.description !== undefined) strategy.description = input.description;

    let version = current;
    const next = {
      rules: input.rules ?? current.rules,
      meta: input.meta ?? current.meta,
    };
    // Only rule/meta changes mint a version. Historical analyses keep pointing
    // at the version they were actually evaluated against.
    if (fingerprint(next) !== fingerprint(current)) {
      version = {
        id: uid('ver'),
        strategyId: strategy.id,
        version: current.version + 1,
        mode: current.mode,
        rules: next.rules,
        ...(next.meta ? { meta: next.meta } : {}),
        createdAt: new Date().toISOString(),
      };
      snapshot.versions.push(version);
      strategy.currentVersionId = version.id;
    }
    strategy.updatedAt = new Date().toISOString();
    this.write(snapshot);
    return { strategy, version };
  }

  async duplicate(id: string): Promise<StrategyWithVersion> {
    const existing = await this.get(id);
    if (!existing) throw new Error(`Strategy ${id} not found`);
    return this.create({
      name: `${existing.strategy.name} (copy)`,
      mode: existing.strategy.mode,
      ...(existing.strategy.description ? { description: existing.strategy.description } : {}),
      rules: existing.version.rules,
      ...(existing.version.meta ? { meta: existing.version.meta } : {}),
    });
  }

  async setStatus(id: string, status: Strategy['status']): Promise<StrategyWithVersion> {
    const snapshot = this.read();
    const strategy = snapshot.strategies.find((s) => s.id === id);
    if (!strategy) throw new Error(`Strategy ${id} not found`);
    strategy.status = status;
    strategy.updatedAt = new Date().toISOString();
    this.write(snapshot);
    const hydrated = this.hydrate(snapshot, strategy);
    if (!hydrated) throw new Error(`Version for strategy ${id} not found`);
    return hydrated;
  }

  async remove(id: string): Promise<void> {
    const snapshot = this.read();
    snapshot.strategies = snapshot.strategies.filter((s) => s.id !== id);
    // Versions are retained: historical analyses reference them by id.
    this.write(snapshot);
  }
}

export const strategyRepository: StrategyRepository = new LocalStrategyRepository();
