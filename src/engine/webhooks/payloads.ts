/**
 * Webhook Payload Formatters — converts ObserveAI events into
 * provider-specific payload formats for Dynatrace, Splunk, DataDog,
 * and New Relic.
 */

import {
  type IntegrationProvider,
  type WebhookEventType,
  type WebhookPayload,
  type DynatracePayload,
  type SplunkHECPayload,
  type DataDogEventPayload,
  type NewRelicInsightsPayload,
} from "../../types/webhooks";

// ── Dynatrace ─────────────────────────────────────────────────────

export function formatDynatrace(
  event: WebhookPayload,
): DynatracePayload {
  const severityMap: Record<string, "info" | "warning" | "error" | "critical"> = {
    "trace.created": "info",
    "trace.flagged": "warning",
    "trace.blocked": "error",
    "alert.triggered": "critical",
    "alert.resolved": "info",
    "guardrail.block": "critical",
    "guardrail.flag": "warning",
    "report.generated": "info",
  };

  const titleMap: Record<WebhookEventType, string> = {
    "trace.created": "New trace ingested",
    "trace.flagged": "Trace flagged",
    "trace.blocked": "Trace blocked",
    "alert.triggered": "Alert triggered",
    "alert.resolved": "Alert resolved",
    "guardrail.block": "Guardrail blocked response",
    "guardrail.flag": "Guardrail flagged response",
    "report.generated": "Weekly report generated",
  };

  return {
    eventType: "observeai." + event.eventType,
    title: titleMap[event.eventType] ?? event.eventType,
    description: JSON.stringify(event.payload),
    tags: ["observeai", event.eventType.replace(".", ":")],
    severity: severityMap[event.eventType] ?? "info",
    properties: {
      ...event.payload,
      source: event.source,
      observeai_event: event.eventType,
    },
    timing: {
      start: event.timestamp,
    },
  };
}

// ── Splunk HEC ────────────────────────────────────────────────────

export function formatSplunk(event: WebhookPayload): SplunkHECPayload {
  return {
    event: {
      ...event.payload,
      observeai_event: event.eventType,
      observeai_source: event.source,
    },
    sourcetype: "observeai:" + event.eventType,
    source: "observeai",
    host: "app.observeai.com",
    time: event.timestamp / 1000,
  };
}

// ── DataDog ────────────────────────────────────────────────────────

export function formatDataDog(event: WebhookPayload): DataDogEventPayload {
  const alertTypeMap: Record<string, "info" | "warning" | "error" | "success"> = {
    "trace.created": "info",
    "trace.flagged": "warning",
    "trace.blocked": "error",
    "alert.triggered": "error",
    "alert.resolved": "success",
    "guardrail.block": "error",
    "guardrail.flag": "warning",
    "report.generated": "info",
  };

  return {
    title: `[ObserveAI] ${event.eventType}`,
    text: JSON.stringify(event.payload, null, 2),
    alert_type: alertTypeMap[event.eventType] ?? "info",
    date_happened: Math.floor(event.timestamp / 1000),
    tags: ["observeai", `event:${event.eventType}`],
    source_type_name: "observeai",
  };
}

// ── New Relic Insights ────────────────────────────────────────────

export function formatNewRelic(event: WebhookPayload): NewRelicInsightsPayload {
  return {
    eventType: "ObserveAIEvent",
    timestamp: event.timestamp,
    observeai_event: event.eventType,
    observeai_source: event.source,
    ...event.payload,
  };
}

// ── Formatter router ──────────────────────────────────────────────

export function formatForProvider(
  provider: IntegrationProvider,
  event: WebhookPayload,
): Record<string, unknown> {
  switch (provider) {
    case "dynatrace":
      return formatDynatrace(event) as unknown as Record<string, unknown>;
    case "splunk":
      return formatSplunk(event) as unknown as Record<string, unknown>;
    case "datadog":
      return formatDataDog(event) as unknown as Record<string, unknown>;
    case "newrelic":
      return formatNewRelic(event) as unknown as Record<string, unknown>;
    case "custom":
      return event.payload;
  }
}