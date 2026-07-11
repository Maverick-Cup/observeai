/**
 * Ingestion Pipeline — the core orchestrator
 *
 * Flow: Receive → Validate → Detect format → Transform → Score → Store
 */

import type { IngestEvent, IngestBatch, IngestionFormat, IngestionSource, IngestionStatus, TransformationResult } from "../../types/ingestion";
import { validatePayload, validateBatch } from "./validators";
import { detectTransformer } from "./transformers";
import { ingestStore } from "./store";
import { DEFAULT_PIPELINE_CONFIG, type PipelineConfig, type PipelineContext } from "./types";

// ── ID generation ────────────────────────────────────────────────

function generateId(prefix = "ing"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ── Ingest a single event ─────────────────────────────────────────

export async function ingestEvent(
  body: unknown,
  source: IngestionSource,
  format?: IngestionFormat,
  config: PipelineConfig = DEFAULT_PIPELINE_CONFIG,
): Promise<IngestEvent> {
  const eventId = generateId("evt");
  const startedAt = Date.now();

  const event: IngestEvent = {
    id: eventId,
    source,
    format: format ?? "json",
    body,
    receivedAt: startedAt,
    status: "received",
  };

  const ctx: PipelineContext = { event, startedAt };

  try {
    // 1. Received
    event.status = "received";
    await ingestStore.saveEvent(event);

    // 2. Validate
    event.status = "validating";
    const payload = typeof body === "object" && body !== null ? body as Record<string, unknown> : { raw: String(body) };
    const validation = validatePayload(payload, event.format);

    if (!validation.valid) {
      event.status = "rejected";
      event.errorMessage = validation.errors.map((e) => e.message).join("; ");
      await ingestStore.saveEvent(event);
      return event;
    }

    // 3. Detect & transform
    event.status = "transforming";
    const transformer = detectTransformer(body) ?? detectTransformer(payload);

    if (!transformer) {
      event.status = "rejected";
      event.errorMessage = `No transformer available for format: ${event.format}`;
      await ingestStore.saveEvent(event);
      return event;
    }

    let transformResult: TransformationResult;
    try {
      transformResult = await Promise.race([
        transformer.transform(body),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Transform timeout")), config.timeoutMs),
        ),
      ]);
    } catch (err) {
      event.status = "failed";
      event.errorMessage = err instanceof Error ? err.message : "Transform timed out";
      await ingestStore.saveEvent(event);
      return event;
    }

    if (!transformResult.success) {
      event.status = "failed";
      event.errorMessage = transformResult.errorMessage ?? "Transform failed";
      await ingestStore.saveEvent(event);
      return event;
    }

    // 4. Completed
    event.status = "completed";
    event.traceId = transformResult.traceId;
    event.processingLatencyMs = Date.now() - startedAt;
    await ingestStore.saveEvent(event);

    return event;
  } catch (err) {
    event.status = "failed";
    event.errorMessage = err instanceof Error ? err.message : "Pipeline error";
    await ingestStore.saveEvent(event);
    return event;
  }
}

// ── Ingest a batch of events ──────────────────────────────────────

export async function ingestBatch(
  payloads: unknown[],
  source: IngestionSource,
  format: IngestionFormat = "json",
  config: PipelineConfig = DEFAULT_PIPELINE_CONFIG,
): Promise<IngestBatch> {
  const batchId = generateId("batch");
  const startedAt = Date.now();
  const trimmed = payloads.slice(0, config.maxBatchSize);

  const batch: IngestBatch = {
    id: batchId,
    source,
    format,
    events: [],
    receivedAt: startedAt,
    status: "received",
    eventCount: trimmed.length,
    successCount: 0,
    failureCount: 0,
  };

  await ingestStore.saveBatch(batch);

  const results = await Promise.allSettled(
    trimmed.map((body) => ingestEvent(body, source, format, config)),
  );

  const events: IngestEvent[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      events.push(result.value);
      if (result.value.status === "completed") batch.successCount++;
      else batch.failureCount++;
    } else {
      const failedEvent: IngestEvent = {
        id: generateId("evt"),
        source,
        format,
        body: null,
        receivedAt: Date.now(),
        status: "failed",
        errorMessage: result.reason instanceof Error ? result.reason.message : "Unknown error",
      };
      events.push(failedEvent);
      batch.failureCount++;
    }
  }

  batch.events = events;
  batch.completedAt = Date.now();
  batch.totalLatencyMs = batch.completedAt - startedAt;
  batch.status = config.allowPartialFailures ? "completed" : (batch.failureCount > 0 ? "failed" : "completed");

  await ingestStore.saveBatch(batch);
  return batch;
}

// ── Convenience wrappers ─────────────────────────────────────────

export async function ingestJSON(
  payload: Record<string, unknown> | Record<string, unknown>[],
  source: IngestionSource = "rest_api",
): Promise<IngestEvent | IngestBatch> {
  if (Array.isArray(payload)) {
    return ingestBatch(payload, source, "json");
  }
  return ingestEvent(payload, source, "json");
}

export async function ingestSyslog(
  raw: string,
  source: IngestionSource = "syslog_daemon",
): Promise<IngestEvent> {
  return ingestEvent(raw, source, "syslog");
}

export async function ingestOTel(
  spans: unknown[],
  source: IngestionSource = "otel_collector",
): Promise<IngestEvent | IngestBatch> {
  if (Array.isArray(spans) && spans.length > 1) {
    return ingestBatch(spans, source, "otel");
  }
  return ingestEvent(spans[0] ?? spans, source, "otel");
}

export async function ingestCSV(
  csvText: string,
  source: IngestionSource = "csv_upload",
): Promise<IngestEvent> {
  return ingestEvent(csvText, source, "csv");
}