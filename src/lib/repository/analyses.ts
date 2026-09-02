import type { AnalysisRecord, Outcome } from '@/types/analysis';
import type { KeyValueStore } from './local';

const STORAGE_KEY = 'strategyai.analyses.v1';

export interface AnalysisRepository {
  list(): Promise<AnalysisRecord[]>;
  get(id: string): Promise<AnalysisRecord | null>;
  save(record: AnalysisRecord): Promise<AnalysisRecord>;
  /** Records or corrects what happened after the analysis. */
  setOutcome(id: string, outcome: Outcome | null): Promise<AnalysisRecord>;
  remove(id: string): Promise<void>;
}

/** Browser-local analyses. Swapped for the database implementation in Phase 6. */
export class LocalAnalysisRepository implements AnalysisRepository {
  constructor(private readonly injected?: KeyValueStore) {}

  private backend(): KeyValueStore | null {
    if (this.injected) return this.injected;
    return typeof window === 'undefined' ? null : window.localStorage;
  }

  private read(): AnalysisRecord[] {
    const store = this.backend();
    if (!store) return [];
    try {
      const raw = store.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as AnalysisRecord[]) : [];
    } catch {
      return [];
    }
  }

  private write(records: AnalysisRecord[]): void {
    this.backend()?.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  async list(): Promise<AnalysisRecord[]> {
    return this.read().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(id: string): Promise<AnalysisRecord | null> {
    return this.read().find((r) => r.id === id) ?? null;
  }

  async save(record: AnalysisRecord): Promise<AnalysisRecord> {
    const records = this.read();
    const index = records.findIndex((r) => r.id === record.id);
    if (index >= 0) records[index] = record;
    else records.push(record);
    this.write(records);
    return record;
  }

  async setOutcome(id: string, outcome: Outcome | null): Promise<AnalysisRecord> {
    const records = this.read();
    const index = records.findIndex((r) => r.id === id);
    const existing = records[index];
    if (index < 0 || !existing) throw new Error(`Analysis ${id} not found`);
    // The analysis itself is never rewritten: the verdict stated what was true
    // at the time and stays that way.
    const next: AnalysisRecord = { ...existing };
    if (outcome) next.outcome = outcome;
    else delete next.outcome;
    records[index] = next;
    this.write(records);
    return next;
  }

  async remove(id: string): Promise<void> {
    this.write(this.read().filter((r) => r.id !== id));
  }
}

export const analysisRepository: AnalysisRepository = new LocalAnalysisRepository();
