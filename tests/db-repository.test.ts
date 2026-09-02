import { describe, it, expect, beforeAll } from 'vitest';
import { getDb, schema } from '@/db/client';
import { DbStrategyRepository } from '@/lib/repository/db-strategies';
import { DbAnalysisRepository } from '@/lib/repository/db-analyses';
import { hashPassword, verifyPassword, validateCredentials } from '@/lib/auth/passwords';
import { nyAmFvgPreset, qualityGrowthPreset } from '@/features/strategies/presets';
import type { AnalysisRecord } from '@/types/analysis';

/** Each test gets its own user, which also exercises per-user scoping. */
let counter = 0;
async function makeUser(): Promise<string> {
  const db = await getDb();
  counter += 1;
  const id = `usr_test_${counter}`;
  await db.insert(schema.users).values({
    id, email: `test${counter}@example.com`, passwordHash: 'scrypt$00$00',
  });
  return id;
}

beforeAll(async () => { await getDb(); });

describe('password hashing', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
    expect(await verifyPassword('correct horse battery stapl', hash)).toBe(false);
  });

  it('produces a different hash each time', async () => {
    expect(await hashPassword('same password')).not.toBe(await hashPassword('same password'));
  });

  it('rejects malformed stored hashes rather than throwing', async () => {
    for (const stored of ['', 'nonsense', 'scrypt$only-one-part', 'md5$aa$bb']) {
      expect(await verifyPassword('anything', stored)).toBe(false);
    }
  });

  it('validates credentials', () => {
    expect(validateCredentials('not-an-email', 'longenoughpassword')?.field).toBe('email');
    expect(validateCredentials('a@b.co', 'short')?.field).toBe('password');
    expect(validateCredentials('a@b.co', 'longenoughpassword')).toBeNull();
  });
});

describe('DbStrategyRepository', () => {
  it('round-trips every rule kind through relational columns', async () => {
    const repo = new DbStrategyRepository(await makeUser());
    const { strategy, version } = await repo.create(nyAmFvgPreset());
    expect(version.version).toBe(1);

    const loaded = await repo.get(strategy.id);
    expect(loaded?.version.rules).toHaveLength(6);

    const numeric = loaded?.version.rules.find((r) => r.metric === 'rr');
    expect(numeric).toMatchObject({ kind: 'numeric', operator: '>=', value: 2, unit: 'multiple' });

    const temporal = loaded?.version.rules.find((r) => r.metric === 'entry_time');
    expect(temporal).toMatchObject({
      kind: 'temporal',
      window: { start: '09:30', end: '11:00', timezone: 'America/New_York' },
    });

    const boolean = loaded?.version.rules.find((r) => r.metric === 'htf_fvg');
    expect(boolean).toMatchObject({ kind: 'boolean', expected: true, mandatory: true, onFail: 'reject' });

    // Order is preserved.
    expect(loaded?.version.rules.map((r) => r.metric)).toEqual(version.rules.map((r) => r.metric));
  });

  it('preserves the builder rule ids so results can reference them', async () => {
    const repo = new DbStrategyRepository(await makeUser());
    const preset = nyAmFvgPreset();
    const { strategy } = await repo.create(preset);
    const loaded = await repo.get(strategy.id);
    expect(loaded?.version.rules.map((r) => r.id)).toEqual(preset.rules.map((r) => r.id));
  });

  it('renaming does not create a version, editing rules does', async () => {
    const repo = new DbStrategyRepository(await makeUser());
    const { strategy, version } = await repo.create(nyAmFvgPreset());

    const renamed = await repo.update(strategy.id, { name: 'Renamed' });
    expect(renamed.version.id).toBe(version.id);
    expect(renamed.strategy.name).toBe('Renamed');

    const edited = version.rules.map((r) => (r.metric === 'rr' && r.kind === 'numeric' ? { ...r, value: 3 } : r));
    const updated = await repo.update(strategy.id, { rules: edited });
    expect(updated.version.version).toBe(2);

    // The old version still says 2.0 - historical analyses keep their meaning.
    const original = await repo.getVersion(version.id);
    expect(original?.rules.find((r) => r.metric === 'rr')).toMatchObject({ value: 2 });
  });

  it('duplicates, archives, reactivates and deletes', async () => {
    const repo = new DbStrategyRepository(await makeUser());
    const { strategy } = await repo.create(qualityGrowthPreset());

    const copy = await repo.duplicate(strategy.id);
    expect(copy.strategy.id).not.toBe(strategy.id);
    expect(copy.strategy.name).toBe('Quality Growth (copy)');
    expect(copy.version.rules).toHaveLength(7);

    expect((await repo.setStatus(strategy.id, 'archived')).strategy.status).toBe('archived');
    expect((await repo.setStatus(strategy.id, 'active')).strategy.status).toBe('active');

    await repo.remove(strategy.id);
    expect(await repo.get(strategy.id)).toBeNull();
    expect(await repo.get(copy.strategy.id)).not.toBeNull();
  });

  it('never returns another account\'s strategy', async () => {
    const owner = new DbStrategyRepository(await makeUser());
    const stranger = new DbStrategyRepository(await makeUser());
    const { strategy, version } = await owner.create(nyAmFvgPreset());

    expect(await stranger.get(strategy.id)).toBeNull();
    expect(await stranger.getVersion(version.id)).toBeNull();
    expect(await stranger.list()).toEqual([]);

    // A delete aimed at someone else's id must not remove it.
    await stranger.remove(strategy.id);
    expect(await owner.get(strategy.id)).not.toBeNull();
  });
});

function sampleAnalysis(strategyId: string, versionId: string): AnalysisRecord {
  return {
    id: 'client-supplied-id',
    createdAt: '2026-03-10T15:00:00.000Z',
    mode: 'trading',
    subject: 'EURUSD',
    strategyId,
    strategyName: 'NY AM FVG',
    strategyVersionId: versionId,
    strategyVersion: 1,
    verdict: 'REJECTED',
    reason: '1 mandatory rule failed: Minimum RR 2.0.',
    summary: { mandatoryTotal: 5, mandatoryPassed: 4, optionalTotal: 1, optionalPassed: 1 },
    results: [
      { ruleId: 'r1', metric: 'r1', label: 'HTF FVG exists', status: 'PASS', mandatory: true, onFail: 'reject', expected: 'present', actual: 'present', reason: 'ok', source: 'vision', asOf: '2026-03-10T14:00:00.000Z' },
      { ruleId: 'r5', metric: 'r5', label: 'Minimum RR 2.0', status: 'FAIL', mandatory: true, onFail: 'reject', expected: '≥ 2x', actual: '1.5x', reason: 'too low', source: 'computed' },
    ],
    computed: { rr: 1.5, risk: 2, reward: 3 },
    observations: { entry: { value: 100, source: 'user', asOf: '2026-03-10T14:00:00.000Z' } },
    provider: { name: 'Demo reader (no AI)', isMock: true },
  };
}

describe('DbAnalysisRepository', () => {
  it('stores rule results as rows and reads them back in order', async () => {
    const userId = await makeUser();
    const strategies = new DbStrategyRepository(userId);
    const analyses = new DbAnalysisRepository(userId);
    const { strategy, version } = await strategies.create(nyAmFvgPreset());

    const saved = await analyses.save(sampleAnalysis(strategy.id, version.id));
    expect(saved.results.map((r) => r.ruleId)).toEqual(['r1', 'r5']);
    expect(saved.results[1]).toMatchObject({ status: 'FAIL', actual: '1.5x', source: 'computed' });
    expect(saved.summary).toEqual({ mandatoryTotal: 5, mandatoryPassed: 4, optionalTotal: 1, optionalPassed: 1 });
    expect(saved.computed['rr']).toBe(1.5);
    expect(saved.provider).toEqual({ name: 'Demo reader (no AI)', isMock: true });
  });

  it('assigns its own id so a client cannot overwrite an existing analysis', async () => {
    const userId = await makeUser();
    const repo = new DbAnalysisRepository(userId);
    const strategies = new DbStrategyRepository(userId);
    const { strategy, version } = await strategies.create(nyAmFvgPreset());

    const first = await repo.save(sampleAnalysis(strategy.id, version.id));
    const second = await repo.save(sampleAnalysis(strategy.id, version.id));
    expect(first.id).not.toBe('client-supplied-id');
    expect(second.id).not.toBe(first.id);
    expect(await repo.list()).toHaveLength(2);
  });

  it('keeps analyses readable after the strategy is deleted', async () => {
    const userId = await makeUser();
    const strategies = new DbStrategyRepository(userId);
    const analyses = new DbAnalysisRepository(userId);
    const { strategy, version } = await strategies.create(nyAmFvgPreset());
    const saved = await analyses.save(sampleAnalysis(strategy.id, version.id));

    await strategies.remove(strategy.id);
    const stillThere = await analyses.get(saved.id);
    expect(stillThere?.strategyName).toBe('NY AM FVG');
    expect(stillThere?.results).toHaveLength(2);
  });

  it('never returns another account\'s analyses', async () => {
    const userId = await makeUser();
    const strategies = new DbStrategyRepository(userId);
    const { strategy, version } = await strategies.create(nyAmFvgPreset());
    const saved = await new DbAnalysisRepository(userId).save(sampleAnalysis(strategy.id, version.id));

    const stranger = new DbAnalysisRepository(await makeUser());
    expect(await stranger.get(saved.id)).toBeNull();
    expect(await stranger.list()).toEqual([]);
    await stranger.remove(saved.id);
    expect(await new DbAnalysisRepository(userId).get(saved.id)).not.toBeNull();
  });
});
