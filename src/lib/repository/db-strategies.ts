import 'server-only';
import { and, asc, desc, eq } from 'drizzle-orm';
import type { Rule, Strategy, StrategyVersion, StrategyMeta, ComparisonOperator } from '@/types/rules';
import { getDb, schema, type Database } from '@/db/client';
import type {
  StrategyRepository, StrategyWithVersion, CreateStrategyInput, UpdateStrategyInput,
} from './types';

type RuleRow = typeof schema.strategyRules.$inferSelect;

function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

/** Rules are stored as columns, so they round-trip through a discriminated union. */
function toRule(row: RuleRow): Rule | null {
  const base = {
    id: row.ruleKey,
    label: row.label,
    mandatory: row.mandatory,
    onFail: row.onFail as 'reject' | 'watch',
    enabled: row.enabled,
    ...(row.note ? { note: row.note } : {}),
  };
  switch (row.kind) {
    case 'numeric':
      if (row.operator === null || row.value === null || row.unit === null) return null;
      return { ...base, kind: 'numeric', metric: row.metric, operator: row.operator as ComparisonOperator, value: row.value, unit: row.unit as never };
    case 'boolean':
      if (row.expected === null) return null;
      return { ...base, kind: 'boolean', metric: row.metric, expected: row.expected };
    case 'temporal':
      if (!row.windowStart || !row.windowEnd || !row.timezone) return null;
      return { ...base, kind: 'temporal', metric: row.metric, window: { start: row.windowStart, end: row.windowEnd, timezone: row.timezone } };
    case 'categorical':
      return { ...base, kind: 'categorical', metric: row.metric, operator: (row.operator === 'not_in' ? 'not_in' : 'in'), values: row.values ?? [] };
    default:
      return null;
  }
}

function ruleRows(versionId: string, rules: Rule[]) {
  return rules.map((rule, position) => ({
    id: uid('rr'),
    versionId,
    ruleKey: rule.id,
    position,
    kind: rule.kind,
    metric: rule.metric,
    label: rule.label,
    mandatory: rule.mandatory,
    onFail: rule.onFail,
    enabled: rule.enabled,
    note: rule.note ?? null,
    operator: rule.kind === 'numeric' ? rule.operator : rule.kind === 'categorical' ? rule.operator : null,
    value: rule.kind === 'numeric' ? rule.value : null,
    unit: rule.kind === 'numeric' ? rule.unit : null,
    expected: rule.kind === 'boolean' ? rule.expected : null,
    windowStart: rule.kind === 'temporal' ? rule.window.start : null,
    windowEnd: rule.kind === 'temporal' ? rule.window.end : null,
    timezone: rule.kind === 'temporal' ? rule.window.timezone : null,
    values: rule.kind === 'categorical' ? rule.values : null,
  }));
}

function fingerprint(rules: Rule[], meta: StrategyMeta | undefined): string {
  return JSON.stringify({
    rules: rules.map((r) => ({ ...r, id: undefined })),
    meta: meta ?? {},
  });
}

/**
 * Postgres-backed strategies, scoped to one user.
 *
 * Every query filters by userId. There is no code path that reads another
 * account's strategy, including by direct id.
 */
export class DbStrategyRepository implements StrategyRepository {
  constructor(private readonly userId: string) {}

  private async db(): Promise<Database> {
    return getDb();
  }

  private async hydrate(db: Database, strategy: typeof schema.strategies.$inferSelect): Promise<StrategyWithVersion | null> {
    if (!strategy.currentVersionId) return null;
    const version = await this.loadVersion(db, strategy.currentVersionId);
    if (!version) return null;
    return { strategy: toStrategy(strategy), version };
  }

  private async loadVersion(db: Database, versionId: string): Promise<StrategyVersion | null> {
    const [row] = await db.select().from(schema.strategyVersions)
      .where(eq(schema.strategyVersions.id, versionId)).limit(1);
    if (!row) return null;
    const rules = await db.select().from(schema.strategyRules)
      .where(eq(schema.strategyRules.versionId, versionId))
      .orderBy(asc(schema.strategyRules.position));
    return {
      id: row.id,
      strategyId: row.strategyId,
      version: row.version,
      mode: row.mode as 'trading' | 'investing',
      rules: rules.map(toRule).filter((r): r is Rule => r !== null),
      ...(row.meta ? { meta: row.meta as StrategyMeta } : {}),
      createdAt: row.createdAt.toISOString(),
    };
  }

  async list(): Promise<StrategyWithVersion[]> {
    const db = await this.db();
    const rows = await db.select().from(schema.strategies)
      .where(eq(schema.strategies.userId, this.userId))
      .orderBy(desc(schema.strategies.updatedAt));
    const out: StrategyWithVersion[] = [];
    for (const row of rows) {
      const hydrated = await this.hydrate(db, row);
      if (hydrated) out.push(hydrated);
    }
    return out;
  }

  async get(id: string): Promise<StrategyWithVersion | null> {
    const db = await this.db();
    const [row] = await db.select().from(schema.strategies)
      .where(and(eq(schema.strategies.id, id), eq(schema.strategies.userId, this.userId)))
      .limit(1);
    return row ? this.hydrate(db, row) : null;
  }

  async getVersion(versionId: string): Promise<StrategyVersion | null> {
    const db = await this.db();
    const version = await this.loadVersion(db, versionId);
    if (!version) return null;
    // Confirm the version belongs to this user before returning it.
    const [owner] = await db.select({ userId: schema.strategies.userId })
      .from(schema.strategies).where(eq(schema.strategies.id, version.strategyId)).limit(1);
    return owner?.userId === this.userId ? version : null;
  }

  async create(input: CreateStrategyInput): Promise<StrategyWithVersion> {
    const db = await this.db();
    const strategyId = uid('str');
    const versionId = uid('ver');
    await db.insert(schema.strategies).values({
      id: strategyId, userId: this.userId, name: input.name, mode: input.mode,
      description: input.description ?? null, status: 'active', currentVersionId: versionId,
    });
    await db.insert(schema.strategyVersions).values({
      id: versionId, strategyId, version: 1, mode: input.mode, meta: asJson(input.meta),
    });
    if (input.rules.length > 0) {
      await db.insert(schema.strategyRules).values(ruleRows(versionId, input.rules));
    }
    const created = await this.get(strategyId);
    if (!created) throw new Error('Strategy could not be created.');
    return created;
  }

  async update(id: string, input: UpdateStrategyInput): Promise<StrategyWithVersion> {
    const db = await this.db();
    const existing = await this.get(id);
    if (!existing) throw new Error(`Strategy ${id} not found`);

    const nextRules = input.rules ?? existing.version.rules;
    const nextMeta = input.meta ?? existing.version.meta;
    const changed = fingerprint(nextRules, nextMeta) !== fingerprint(existing.version.rules, existing.version.meta);

    if (changed) {
      const versionId = uid('ver');
      await db.insert(schema.strategyVersions).values({
        id: versionId, strategyId: id, version: existing.version.version + 1,
        mode: existing.strategy.mode, meta: asJson(nextMeta),
      });
      if (nextRules.length > 0) {
        await db.insert(schema.strategyRules).values(ruleRows(versionId, nextRules));
      }
      await db.update(schema.strategies).set({ currentVersionId: versionId }).where(eq(schema.strategies.id, id));
    }

    await db.update(schema.strategies).set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      updatedAt: new Date(),
    }).where(and(eq(schema.strategies.id, id), eq(schema.strategies.userId, this.userId)));

    const updated = await this.get(id);
    if (!updated) throw new Error('Strategy could not be updated.');
    return updated;
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
    const db = await this.db();
    await db.update(schema.strategies).set({ status, updatedAt: new Date() })
      .where(and(eq(schema.strategies.id, id), eq(schema.strategies.userId, this.userId)));
    const updated = await this.get(id);
    if (!updated) throw new Error(`Strategy ${id} not found`);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const db = await this.db();
    await db.delete(schema.strategies)
      .where(and(eq(schema.strategies.id, id), eq(schema.strategies.userId, this.userId)));
  }
}

/** jsonb columns want a plain record; StrategyMeta has no index signature. */
function asJson(meta: StrategyMeta | undefined): Record<string, unknown> | null {
  return meta ? ({ ...meta } as Record<string, unknown>) : null;
}

function toStrategy(row: typeof schema.strategies.$inferSelect): Strategy {
  return {
    id: row.id,
    name: row.name,
    mode: row.mode as 'trading' | 'investing',
    ...(row.description ? { description: row.description } : {}),
    currentVersionId: row.currentVersionId ?? '',
    status: row.status as Strategy['status'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
