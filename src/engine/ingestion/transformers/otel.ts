/**
 * OpenTelemetry / CloudWatch Transformer
 *
 * Converts OTel span data (or CloudWatch log events) into ObserveAI trace format.
 * Supports both individual spans and batch span exports.
 */

import type { TransformerAdapter } from "../types";
import type { TransformationResult } from "../../../types/ingestion";

interface OtelSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  traceState?: string;
  name: string;
  kind?: number;
  startTimeUnixNano?: string | number;
  endTimeUnixNano?: string | number;
  attributes?: Array<{ key: string; value: { stringValue?: string; intValue?: string; doubleValue?: number; boolValue?: boolean } }>;
  status?: { code?: number; message?: string };
}

interface CloudWatchLogEvent {
  id?: string;
  timestamp?: number;
  message: string;
  logGroupName?: string;
  logStreamName?: string;
}

function nsecToMs(nano: string | number | undefined): number {
  if (!nano) return 0;
  const n = typeof nano === "string" ? parseInt(nano, 10) : nano;
  return Math.round(n / 1_000_000);
}

function extractAttributes(attrs?: OtelSpan["attributes"]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!attrs) return result;
  for (const attr of attrs) {
    const val = attr.value.stringValue ?? attr.value.intValue ?? attr.value.doubleValue ?? attr.value.boolValue;
    if (val !== undefined) result[attr.key] = val;
  }
  return result;
}

function isOtelSpan(raw: unknown): raw is OtelSpan {
  if (typeof raw !== "object" || raw === null) return false;
  const s = raw as OtelSpan;
  return typeof s.traceId === "string" && typeof s.spanId === "string" && typeof s.name === "string";
}

function isCloudWatchEvent(raw: unknown): raw is CloudWatchLogEvent {
  if (typeof raw !== "object" || raw === null) return false;
  const c = raw as CloudWatchLogEvent;
  return typeof c.message === "string" && (c.timestamp !== undefined || c.id !== undefined);
}

// ── Transformers ────────────────────────────────────────────────

async function transformOtelSpan(span: OtelSpan): Promise<TransformationResult> {
  const attrs = extractAttributes(span.attributes);
  const durationMs = nsecToMs(span.endTimeUnixNano) - nsecToMs(span.startTimeUnixNano);

  return {
    success: true,
    traceId: span.traceId,
    spans: [
      {
        name: span.name,
        durationMs: Math.max(durationMs, 0),
        metadata: {
          ...attrs,
          spanId: span.spanId,
          parentSpanId: span.parentSpanId,
          kind: span.kind,
          statusCode: span.status?.code,
          statusMessage: span.status?.message,
          source: "opentelemetry",
        },
      },
    ],
  };
}

async function transformCloudWatchEvent(event: CloudWatchLogEvent): Promise<TransformationResult> {
  let parsedMessage: Record<string, unknown> = {};
  try {
    parsedMessage = JSON.parse(event.message);
  } catch {
    parsedMessage = { raw: event.message };
  }

  return {
    success: true,
    traceId: `cw-${event.id ?? Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    spans: [
      {
        name: `cloudwatch.${event.logGroupName ?? "unknown"}`,
        durationMs: 0,
        metadata: {
          ...parsedMessage,
          logGroup: event.logGroupName,
          logStream: event.logStreamName,
          source: "cloudwatch",
          timestamp: event.timestamp,
        },
      },
    ],
  };
}

// ── Adapter ──────────────────────────────────────────────────────

export const otelTransformer: TransformerAdapter = {
  name: "opentelemetry",
  format: "otel",

  supports(raw: unknown): boolean {
    if (Array.isArray(raw)) {
      return raw.length > 0 && (isOtelSpan(raw[0]) || isCloudWatchEvent(raw[0]));
    }
    return isOtelSpan(raw) || isCloudWatchEvent(raw);
  },

  async transform(raw: unknown): Promise<TransformationResult> {
    try {
      // Batch of spans
      if (Array.isArray(raw)) {
        if (raw.length === 0) {
          return { success: false, errorMessage: "Empty OTel batch" };
        }

        if (isOtelSpan(raw[0])) {
          const results = await Promise.all(raw.map((s) => transformOtelSpan(s as OtelSpan)));
          const first = results[0];
          const allSpans = results.flatMap((r) => r.spans ?? []);
          return {
            success: first.success,
            traceId: first.traceId,
            spans: allSpans,
            errorMessage: results.some((r) => !r.success) ? "Partial span failures" : undefined,
          };
        }

        if (isCloudWatchEvent(raw[0])) {
          const results = await Promise.all(raw.map((e) => transformCloudWatchEvent(e as CloudWatchLogEvent)));
          const first = results[0];
          return {
            success: first.success,
            traceId: first.traceId,
            spans: results.flatMap((r) => r.spans ?? []),
          };
        }

        return { success: false, errorMessage: "Unknown OTel batch format" };
      }

      // Single span
      if (isOtelSpan(raw)) {
        return transformOtelSpan(raw);
      }

      // Single CloudWatch event
      if (isCloudWatchEvent(raw)) {
        return transformCloudWatchEvent(raw);
      }

      return { success: false, errorMessage: "Unknown OTel/CloudWatch format" };
    } catch (err) {
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : "OTel transform failed",
      };
    }
  },
};