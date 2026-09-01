import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStrategyRepository, type KeyValueStore } from '@/lib/repository/local';
import { nyAmFvgPreset } from '@/features/strategies/presets';

/** In-memory stand-in for localStorage, injected so no browser is needed. */
function memoryStore(): KeyValueStore {
  const store = new Map<string, string>();
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, v),
  };
}

describe('LocalStrategyRepository', () => {
  let store: KeyValueStore;
  let repo: LocalStrategyRepository;
  beforeEach(() => {
    store = memoryStore();
    repo = new LocalStrategyRepository(store);
  });

  it('creates a strategy at version 1 and reads it back', async () => {
    const { strategy, version } = await repo.create(nyAmFvgPreset());
    expect(version.version).toBe(1);
    expect(strategy.currentVersionId).toBe(version.id);
    expect((await repo.get(strategy.id))?.version.rules).toHaveLength(6);
  });

  it('renaming does NOT create a new version', async () => {
    const { strategy, version } = await repo.create(nyAmFvgPreset());
    const updated = await repo.update(strategy.id, { name: 'Renamed' });
    expect(updated.version.id).toBe(version.id);
    expect(updated.version.version).toBe(1);
    expect(updated.strategy.name).toBe('Renamed');
  });

  it('changing a rule creates a new version and leaves the old one intact', async () => {
    const { strategy, version } = await repo.create(nyAmFvgPreset());
    const edited = version.rules.map((r) =>
      r.kind === 'numeric' && r.metric === 'rr' ? { ...r, value: 3 } : r,
    );
    const updated = await repo.update(strategy.id, { rules: edited });

    expect(updated.version.version).toBe(2);
    expect(updated.version.id).not.toBe(version.id);

    // The historical version is still retrievable and still says 2.0 - this is
    // what keeps past analyses meaningful.
    const original = await repo.getVersion(version.id);
    const originalRr = original?.rules.find((r) => r.metric === 'rr');
    expect(originalRr).toMatchObject({ value: 2 });
  });

  it('changing meta alone also creates a version', async () => {
    const { strategy } = await repo.create(nyAmFvgPreset());
    const updated = await repo.update(strategy.id, { meta: { market: 'crypto' } });
    expect(updated.version.version).toBe(2);
  });

  it('duplicates a strategy without linking the copies', async () => {
    const { strategy } = await repo.create(nyAmFvgPreset());
    const copy = await repo.duplicate(strategy.id);
    expect(copy.strategy.id).not.toBe(strategy.id);
    expect(copy.strategy.name).toBe('NY AM FVG (copy)');
    expect(copy.version.rules).toHaveLength(6);

    await repo.update(copy.strategy.id, { rules: [] });
    expect((await repo.get(strategy.id))?.version.rules).toHaveLength(6);
  });

  it('archives and reactivates', async () => {
    const { strategy } = await repo.create(nyAmFvgPreset());
    expect((await repo.setStatus(strategy.id, 'archived')).strategy.status).toBe('archived');
    expect((await repo.setStatus(strategy.id, 'active')).strategy.status).toBe('active');
  });

  it('deleting removes the strategy but retains its versions for historical analyses', async () => {
    const { strategy, version } = await repo.create(nyAmFvgPreset());
    await repo.remove(strategy.id);
    expect(await repo.get(strategy.id)).toBeNull();
    expect(await repo.getVersion(version.id)).not.toBeNull();
  });

  it('survives a corrupt store rather than throwing', async () => {
    store.setItem('strategyai.v2', '{not json');
    expect(await repo.list()).toEqual([]);
  });

  it('does not leak state between repository instances sharing no store', async () => {
    await repo.create(nyAmFvgPreset());
    const isolated = new LocalStrategyRepository(memoryStore());
    expect(await isolated.list()).toEqual([]);
  });

  it('rejects updates to a missing strategy', async () => {
    await expect(repo.update('nope', { name: 'x' })).rejects.toThrow(/not found/);
  });
});
