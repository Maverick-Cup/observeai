/**
 * Convex HTTP Router — Auth + Ingestion Endpoints
 *
 * Legacy apps POST to these endpoints to push trace data into ObserveAI.
 * All ingestion endpoints require an Authorization: Bearer <api_key> header.
 */
import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

// ── Ingestion: JSON (single trace) ────────────────────────────────

http.route({
  path: "/ingest/json",
  method: "POST",
  handler: async (ctx, request) => {
    try {
      const apiKey = extractApiKey(request);
      if (!apiKey) {
        return jsonResponse({ error: "Missing Authorization: Bearer <key> header" }, 401);
      }
      const body = await request.json();
      const result = await ctx.runMutation("traces:ingest", { ...body, apiKey });
      return jsonResponse(result, 200);
    } catch (err: any) {
      return handleIngestError(err);
    }
  },
});

// ── Ingestion: Batch (multiple traces) ────────────────────────────

http.route({
  path: "/ingest/batch",
  method: "POST",
  handler: async (ctx, request) => {
    try {
      const apiKey = extractApiKey(request);
      if (!apiKey) {
        return jsonResponse({ error: "Missing Authorization: Bearer <key> header" }, 401);
      }
      const body = await request.json();
      const traces: Record<string, unknown>[] = Array.isArray(body) ? body : (body.traces ?? [body]);
      const results: Array<{ traceId: string; status: string; result?: unknown; error?: string }> = [];
      for (const trace of traces) {
        try {
          const result = await ctx.runMutation("traces:ingest", { ...trace, apiKey });
          results.push({ traceId: (trace.traceId as string) ?? "unknown", status: "ok", result });
        } catch (err: any) {
          results.push({ traceId: (trace.traceId as string) ?? "unknown", status: "error", error: err.message });
        }
      }
      const failed = results.filter((r) => r.status === "error").length;
      return jsonResponse({ results, total: results.length, failed }, failed > 0 ? 207 : 200);
    } catch (err: any) {
      return jsonResponse({ error: err.message }, 400);
    }
  },
});

// ── Ingestion: Syslog ─────────────────────────────────────────────

http.route({
  path: "/ingest/syslog",
  method: "POST",
  handler: async (ctx, request) => {
    try {
      const apiKey = extractApiKey(request);
      if (!apiKey) {
        return jsonResponse({ error: "Missing Authorization: Bearer <key> header" }, 401);
      }
      const text = await request.text();
      const trace = parseSyslogToTrace(text);
      const result = await ctx.runMutation("traces:ingest", { ...trace, apiKey });
      return jsonResponse(result, 200);
    } catch (err: any) {
      return handleIngestError(err);
    }
  },
});

// ── Ingestion: Raw / Plain Text ───────────────────────────────────

http.route({
  path: "/ingest/raw",
  method: "POST",
  handler: async (ctx, request) => {
    try {
      const apiKey = extractApiKey(request);
      if (!apiKey) {
        return jsonResponse({ error: "Missing Authorization: Bearer <key> header" }, 401);
      }
      const text = await request.text();
      const trace: Record<string, unknown> = {
        traceId: `raw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        status: "success",
        userQuery: text.slice(0, 500),
        metadata: { source: "raw_text", length: text.length },
      };
      const result = await ctx.runMutation("traces:ingest", { ...trace, apiKey });
      return jsonResponse(result, 200);
    } catch (err: any) {
      return handleIngestError(err);
    }
  },
});

// ── Health Check ──────────────────────────────────────────────────

http.route({
  path: "/ingest/health",
  method: "GET",
  handler: async () => {
    return jsonResponse({
      status: "ok",
      service: "observeai-ingestion",
      version: "1.0.0",
      endpoints: {
        json: "/ingest/json",
        batch: "/ingest/batch",
        syslog: "/ingest/syslog",
        raw: "/ingest/raw",
      },
    }, 200);
  },
});

// ── Ingestion: OpenTelemetry ──────────────────────────────────────

http.route({
  path: "/ingest/otel",
  method: "POST",
  handler: async (ctx, request) => {
    try {
      const apiKey = extractApiKey(request);
      if (!apiKey) {
        return jsonResponse({ error: "Missing Authorization: Bearer <key> header" }, 401);
      }
      const body = await request.json();

      // Accept both OTel JSON format and our wrapper format
      // OTel format: { resourceSpans: [{ resource: ..., scopeSpans: [{ spans: [...] }] }] }
      const spans = extractOTelSpans(body);
      if (spans.length === 0) {
        return jsonResponse({ error: "No spans found in OTel payload" }, 400);
      }

      const results = [];
      for (const span of spans) {
        const trace: Record<string, unknown> = {
          traceId: span.traceId ?? `otel-${Date.now()}`,
          status: "success",
          metadata: {
            source: "opentelemetry",
            spanKind: span.kind,
            serviceName: span.serviceName,
          },
          spans: [{
            spanId: span.spanId ?? `span-${Date.now()}`,
            spanName: span.name ?? "llm.call",
            type: "llm",
            startTime: span.startTime ?? Date.now(),
            endTime: span.endTime,
            durationMs: span.durationMs,
            input: span.attributes,
            status: "ok",
          }],
        };
        try {
          const result = await ctx.runMutation("traces:ingest", { ...trace, apiKey });
          results.push({ traceId: trace.traceId, status: "ok", result });
        } catch (err: any) {
          results.push({ traceId: trace.traceId, status: "error", error: err.message });
        }
      }
      return jsonResponse({ results, total: results.length }, 200);
    } catch (err: any) {
      return jsonResponse({ error: err.message }, 400);
    }
  },
});

// ── Helpers ───────────────────────────────────────────────────────

function extractApiKey(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

function handleIngestError(err: any): Response {
  const msg = err.message ?? "Internal error";
  if (msg.includes("UNAUTHORIZED")) return jsonResponse({ error: msg }, 401);
  if (msg.includes("RATE_LIMITED")) return jsonResponse({ error: msg }, 429);
  return jsonResponse({ error: msg }, 400);
}

function parseSyslogToTrace(text: string): Record<string, unknown> {
  // RFC 3164-ish: <PRI>TIMESTAMP HOSTNAME APP[PID]: MESSAGE
  const msgMatch = text.match(/<(\d+)>?\s*(.*?)\s+(\S+)\s+(\S+?)(?:\[(\d+)\])?:\s*(.*)/);
  const message = msgMatch?.[6] ?? text;
  const app = msgMatch?.[4] ?? "unknown";
  const host = msgMatch?.[3] ?? "unknown";
  const traceId = `syslog-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    traceId,
    status: "success",
    userQuery: message.slice(0, 500),
    environment: "production",
    metadata: {
      source: "syslog",
      host,
      app,
      rawPreview: text.slice(0, 300),
    },
  };
}

function extractOTelSpans(body: any): any[] {
  // OTel JSON export format
  if (body.resourceSpans) {
    const spans: any[] = [];
    for (const rs of body.resourceSpans) {
      const serviceName = rs.resource?.attributes?.find(
        (a: any) => a.key === "service.name"
      )?.value?.stringValue ?? "unknown";
      for (const ss of rs.scopeSpans ?? []) {
        for (const span of ss.spans ?? []) {
          spans.push({ ...span, serviceName, attributes: span.attributes });
        }
      }
    }
    return spans;
  }
  // Our wrapper format: { spans: [...] }
  if (body.spans) return body.spans;
  // Array of spans
  if (Array.isArray(body)) return body;
  return [];
}

export default http;