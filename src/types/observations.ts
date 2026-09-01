import type { Unit } from './metrics';

export type ObservationSource =
  | 'vision'          // chart screenshot read by a vision model
  | 'market-api'      // price / OHLCV provider
  | 'financial-api'   // fundamentals provider
  | 'user'            // typed in by the user
  | 'computed'        // derived by application code
  | 'mock';           // clearly-labelled demo provider

export type ObservationValue = number | boolean | string;

/**
 * Every fact carries its provenance. Without this, "INSUFFICIENT DATA" and
 * stale-data handling (spec 7 and 19) cannot be implemented honestly.
 */
export interface Observation<T extends ObservationValue = ObservationValue> {
  /** null means "could not be determined" - never coerce this to false. */
  value: T | null;
  unit?: Unit;
  source: ObservationSource;
  /** ISO-8601 timestamp for when this fact was true, not when it was fetched. */
  asOf: string;
  /** 0..1. Providers that cannot estimate confidence should omit it. */
  confidence?: number;
  /**
   * True when the condition is observable but not yet resolved - e.g. a
   * confirmation candle that has not closed. Drives WATCH rather than REJECTED.
   */
  pending?: boolean;
  note?: string;
}

export type ObservationSet = Record<string, Observation>;
