import type { ObservationSet } from '@/types/observations';
import type { MetricDef } from '@/types/metrics';

export interface ChartImage {
  mimeType: string;
  /** Raw base64, without a data: prefix. */
  base64: string;
}

export interface VisionRequest {
  images: ChartImage[];
  /** Only the metrics this strategy actually needs. Keeps output bounded. */
  requestedMetrics: MetricDef[];
  notes?: string;
}

export interface VisionResult {
  observations: ObservationSet;
  providerName: string;
  /** Non-fatal problems worth showing the user, e.g. "chart was low resolution". */
  warnings: string[];
}

export interface VisionProvider {
  readonly name: string;
  /**
   * True for demo providers. The UI must state this plainly - a mock reading
   * may never be presented as a real chart analysis.
   */
  readonly isMock: boolean;
  readChart(request: VisionRequest): Promise<VisionResult>;
}

/** The provider could not run at all (missing key, network, rate limit). */
export class ProviderUnavailableError extends Error {
  constructor(message: string, readonly retryable = false) {
    super(message);
    this.name = 'ProviderUnavailableError';
  }
}
