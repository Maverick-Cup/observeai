/**
 * Webhook / Legacy Integration types
 */

export type IntegrationProvider =
  | "dynatrace"
  | "splunk"
  | "datadog"
  | "newrelic"
  | "custom";

export type WebhookEventType =
  | "trace.created"
  | "trace.flagged"
  | "trace.blocked"
  | "alert.triggered"
  | "alert.resolved"
  | "guardrail.block"
  | "guardrail.flag"
  | "report.generated";

export interface WebhookIntegration {
  id: string;
  name: string;
  provider: IntegrationProvider;
  endpointUrl: string;
  apiKey?: string;
  isActive: boolean;
  eventFilters: WebhookEventType[];
  createdAt: number;
  lastSentAt?: number;
  lastErrorAt?: number;
  lastErrorMessage?: string;
  totalSent: number;
  totalErrors: number;
}

export interface WebhookPayload {
  eventType: WebhookEventType;
  timestamp: number;
  source: "observeai";
  payload: Record<string, unknown>;
}

export interface DynatracePayload {
  eventType: string;
  title: string;
  description: string;
  tags: string[];
  severity: "info" | "warning" | "error" | "critical";
  properties: Record<string, unknown>;
  timing: { start: number; end?: number };
}

export interface SplunkHECPayload {
  event: Record<string, unknown>;
  sourcetype: string;
  source: string;
  host: string;
  time: number;
  index?: string;
}

export interface DataDogEventPayload {
  title: string;
  text: string;
  alert_type: "info" | "warning" | "error" | "success";
  date_happened: number;
  tags: string[];
  source_type_name: string;
}

export interface NewRelicInsightsPayload {
  eventType: string;
  timestamp: number;
  [key: string]: unknown;
}

export interface IntegrationTestResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  errorMessage?: string;
  latencyMs: number;
}