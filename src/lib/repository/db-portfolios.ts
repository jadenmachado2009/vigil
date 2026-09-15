import 'server-only';
import { and, eq } from 'drizzle-orm';
import type { Portfolio, PortfolioLimits } from '@/lib/portfolio/types';
import { getDb, schema } from '@/db/client';
import type { PortfolioRepository } from './portfolios';

/** Postgres-backed portfolio, one per user, scoped by userId on every query. */
export class DbPortfolioRepository implements PortfolioRepository {
  constructor(private readonly userId: string) {}

  async get(): Promise<Portfolio | null> {
    const db = await getDb();
    const [row] = await db.select().from(schema.portfolios)
      .where(eq(schema.portfolios.userId, this.userId)).limit(1);
    if (!row) return null;
    const positions = await db.select().from(schema.portfolioPositions)
      .where(eq(schema.portfolioPositions.portfolioId, row.id));
    return {
      id: row.id,
      name: row.name,
      limits: (row.rules ?? {}) as PortfolioLimits,
      positions: positions.map((p) => ({
        ticker: p.ticker, weight: p.weight, ...(p.sector ? { sector: p.sector } : {}),
      })),
      updatedAt: (positions[0]?.updatedAt ?? row.createdAt).toISOString(),
    };
  }

  async save(portfolio: Portfolio): Promise<Portfolio> {
    const db = await getDb();
    const existing = await this.get();
    const id = existing?.id ?? `pf_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

    if (existing) {
      await db.update(schema.portfolios)
        .set({ name: portfolio.name, rules: portfolio.limits as Record<string, unknown> })
        .where(and(eq(schema.portfolios.id, id), eq(schema.portfolios.userId, this.userId)));
      await db.delete(schema.portfolioPositions).where(eq(schema.portfolioPositions.portfolioId, id));
    } else {
      await db.insert(schema.portfolios).values({
        id, userId: this.userId, name: portfolio.name, rules: portfolio.limits as Record<string, unknown>,
      });
    }
    if (portfolio.positions.length > 0) {
      await db.insert(schema.portfolioPositions).values(
        portfolio.positions.map((p) => ({
          portfolioId: id, ticker: p.ticker.toUpperCase(), weight: p.weight, sector: p.sector ?? null,
        })),
      );
    }
    const saved = await this.get();
    if (!saved) throw new Error('Portfolio could not be saved.');
    return saved;
  }
}
