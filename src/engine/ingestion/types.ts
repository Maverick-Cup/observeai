/**
 * Internal Ingestion Engine Types
 */

import type {
  IngestEvent,
  IngestBatch,
  IngestionSource,
  IngestionFormat,
  TransformationResult,
  ValidationResult,
  IngestPipelineStats,
} from "../../types/ingestion";

export interface PipelineContext {
  event: IngestEvent;
  batchId?: string;
  startedAt: number;
}

export interface PipelineStage<TInput, TOutput> {
  name: string;
  execute: (input: TInput, ctx: PipelineContext) => Promise<TOutput>;
}

export interface TransformerAdapter {
  name: string;
  format: IngestionFormat;
  supports: (raw: unknown) => boolean;
  transform: (raw: unknown) => Promise<TransformationResult>;
}

export type PipelineMiddleware = (
  stage: string,
  ctx: PipelineContext,
  next: () => Promise<void>,
) => Promise<void>;

export interface PipelineConfig {
  maxBatchSize: number;
  timeoutMs: number;
  requireTraceId: boolean;
  allowPartialFailures: boolean;
  middlewares: PipelineMiddleware[];
}

export interface IngestStore {
  saveEvent: (event: IngestEvent) => Promise<void>;
  saveBatch: (batch: IngestBatch) => Promise<void>;
  getEvent: (id: string) => Promise<IngestEvent | null>;
  getBatch: (id: string) => Promise<IngestBatch | null>;
  getStats: () => Promise<IngestPipelineStats>;
  listRecentEvents: (limit?: number) => Promise<IngestEvent[]>;
  listBatches: (limit?: number) => Promise<IngestBatch[]>;
}

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  maxBatchSize: 1000,
  timeoutMs: 30000,
  requireTraceId: false,
  allowPartialFailures: true,
  middlewares: [],
};