import 'server-only';
import { and, asc, desc, eq } from 'drizzle-orm';
import type { AnalysisRecord, Outcome } from '@/types/analysis';
import type { RuleResult } from '@/types/results';
import type { ObservationSet } from '@/types/observations';
import { getDb, schema, type Database } from '@/db/client';
import type { AnalysisRepository } from './analyses';

function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

/**
 * Postgres-backed analyses, scoped to one user.
 *
 * Rule results are written as rows rather than folded into the analysis JSON:
 * rule-level attribution (spec 14) groups outcomes across analyses by rule, and
 * that is a query, not a document read.
 */
export class DbAnalysisRepository implements AnalysisRepository {
  constructor(private readonly userId: string) {}

  private async db(): Promise<Database> {
    return getDb();
  }

  private async hydrate(db: Database, row: typeof schema.analyses.$inferSelect): Promise<AnalysisRecord> {
    const results = await db.select().from(schema.ruleResults)
      .where(eq(schema.ruleResults.analysisId, row.id))
      .orderBy(asc(schema.ruleResults.position));
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      mode: row.mode as AnalysisRecord['mode'],
      subject: row.subject,
      strategyId: row.strategyId ?? '',
      strategyName: row.strategyName,
      strategyVersionId: row.strategyVersionId ?? '',
      strategyVersion: row.strategyVersion,
      verdict: row.verdict as AnalysisRecord['verdict'],
      reason: row.reason,
      summary: {
        mandatoryTotal: row.mandatoryTotal,
        mandatoryPassed: row.mandatoryPassed,
        optionalTotal: row.optionalTotal,
        optionalPassed: row.optionalPassed,
      },
      results: results.map((r): RuleResult => ({
        ruleId: r.ruleId,
        label: r.label,
        status: r.status as RuleResult['status'],
        mandatory: r.mandatory,
        onFail: r.onFail as RuleResult['onFail'],
        expected: r.expected,
        actual: r.actual,
        reason: r.reason,
        ...(r.source ? { source: r.source as RuleResult['source'] } : {}),
        ...(r.asOf ? { asOf: r.asOf.toISOString() } : {}),
        ...(r.stale ? { stale: true } : {}),
      })),
      computed: row.computed ?? {},
      observations: (row.observations ?? {}) as ObservationSet,
      provider: { name: row.providerName ?? 'unknown', isMock: row.providerIsMock ?? false },
      ...(row.notes ? { notes: row.notes } : {}),
      ...(row.outcome ? { outcome: row.outcome as unknown as Outcome } : {}),
    };
  }

  async list(): Promise<AnalysisRecord[]> {
    const db = await this.db();
    const rows = await db.select().from(schema.analyses)
      .where(eq(schema.analyses.userId, this.userId))
      .orderBy(desc(schema.analyses.createdAt));
    return Promise.all(rows.map((row) => this.hydrate(db, row)));
  }

  async get(id: string): Promise<AnalysisRecord | null> {
    const db = await this.db();
    const [row] = await db.select().from(schema.analyses)
      .where(and(eq(schema.analyses.id, id), eq(schema.analyses.userId, this.userId)))
      .limit(1);
    return row ? this.hydrate(db, row) : null;
  }

  async save(record: AnalysisRecord): Promise<AnalysisRecord> {
    const db = await this.db();
    // Ids are assigned server-side: a client must not be able to overwrite an
    // existing analysis, its own or anyone else's, by choosing an id.
    const id = uid('an');
    await db.insert(schema.analyses).values({
      id,
      userId: this.userId,
      strategyId: record.strategyId || null,
      strategyVersionId: record.strategyVersionId || null,
      strategyName: record.strategyName,
      strategyVersion: record.strategyVersion,
      mode: record.mode,
      subject: record.subject,
      verdict: record.verdict,
      reason: record.reason,
      mandatoryTotal: record.summary.mandatoryTotal,
      mandatoryPassed: record.summary.mandatoryPassed,
      optionalTotal: record.summary.optionalTotal,
      optionalPassed: record.summary.optionalPassed,
      computed: record.computed,
      observations: record.observations as Record<string, unknown>,
      providerName: record.provider.name,
      providerIsMock: record.provider.isMock,
      notes: record.notes ?? null,
      createdAt: new Date(record.createdAt),
    });

    if (record.results.length > 0) {
      await db.insert(schema.ruleResults).values(record.results.map((result, position) => ({
        id: uid('res'),
        analysisId: id,
        ruleId: result.ruleId,
        label: result.label,
        status: result.status,
        mandatory: result.mandatory,
        onFail: result.onFail,
        expected: result.expected,
        actual: result.actual,
        reason: result.reason,
        source: result.source ?? null,
        asOf: result.asOf ? new Date(result.asOf) : null,
        stale: result.stale ?? false,
        position,
      })));
    }

    const saved = await this.get(id);
    if (!saved) throw new Error('Analysis could not be saved.');
    return saved;
  }

  async setOutcome(id: string, outcome: Outcome | null): Promise<AnalysisRecord> {
    const db = await this.db();
    await db.update(schema.analyses)
      .set({ outcome: (outcome as unknown as Record<string, unknown>) ?? null })
      .where(and(eq(schema.analyses.id, id), eq(schema.analyses.userId, this.userId)));
    const updated = await this.get(id);
    if (!updated) throw new Error(`Analysis ${id} not found`);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const db = await this.db();
    await db.delete(schema.analyses)
      .where(and(eq(schema.analyses.id, id), eq(schema.analyses.userId, this.userId)));
  }
}
