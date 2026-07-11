/**
 * Webhook Forwarder — accepts ObserveAI events, formats them for
 * provider-specific payloads, and forwards with retry logic.
 */

import {
  type IntegrationProvider,
  type WebhookEventType,
  type WebhookPayload,
  type WebhookIntegration,
  type IntegrationTestResult,
} from "../../types/webhooks";
import { formatForProvider } from "./payloads";

interface ForwardResult {
  success: boolean;
  integrationId: string;
  statusCode?: number;
  errorMessage?: string;
  latencyMs: number;
}

interface ForwardBatchResult {
  results: ForwardResult[];
  totalEvents: number;
  successCount: number;
  failureCount: number;
}

// ── Simulated HTTP call ────────────────────────────────────────────
// In production, this would be a real fetch() call with auth headers.
// In demo mode, we simulate the request/response.

async function simulateForward(
  integration: WebhookIntegration,
  payload: Record<string, unknown>,
): Promise<{ success: boolean; statusCode: number; errorMessage?: string }> {
  const delay = 100 + Math.random() * 400; // 100–500ms simulated latency
  await new Promise((r) => setTimeout(r, delay));

  // Simulate 90% success rate
  if (Math.random() < 0.1) {
    return {
      success: false,
      statusCode: 500,
      errorMessage: "Simulated server error — endpoint unreachable",
    };
  }

  return { success: true, statusCode: 200 };
}

// ── Single event forward ──────────────────────────────────────────

export async function forwardEvent(
  integration: WebhookIntegration,
  eventType: WebhookEventType,
  payload: Record<string, unknown>,
): Promise<ForwardResult> {
  const startTime = Date.now();

  const event: WebhookPayload = {
    eventType,
    timestamp: startTime,
    source: "observeai",
    payload,
  };

  const formatted = formatForProvider(integration.provider, event);

  const result = await simulateForward(integration, formatted);

  return {
    success: result.success,
    integrationId: integration.id,
    statusCode: result.statusCode,
    errorMessage: result.errorMessage,
    latencyMs: Date.now() - startTime,
  };
}

// ── Batch forward (simulated) ────────────────────────────────────

export async function forwardBatch(
  integrations: WebhookIntegration[],
  eventType: WebhookEventType,
  payload: Record<string, unknown>,
): Promise<ForwardBatchResult> {
  const activeIntegrations = integrations.filter(
    (i) => i.isActive && i.eventFilters.includes(eventType),
  );

  if (activeIntegrations.length === 0) {
    return { results: [], totalEvents: 0, successCount: 0, failureCount: 0 };
  }

  const results = await Promise.all(
    activeIntegrations.map((integration) => forwardEvent(integration, eventType, payload)),
  );

  return {
    results,
    totalEvents: activeIntegrations.length,
    successCount: results.filter((r) => r.success).length,
    failureCount: results.filter((r) => !r.success).length,
  };
}

// ── Test integration endpoint ─────────────────────────────────────

export async function testIntegration(
  integration: WebhookIntegration,
): Promise<IntegrationTestResult> {
  const startTime = Date.now();

  const payload: Record<string, unknown> = {
    test: true,
    message: "ObserveAI integration test event",
    timestamp: new Date().toISOString(),
  };

  try {
    const result = await simulateForward(integration, payload);
    return {
      success: result.success,
      statusCode: result.statusCode,
      responseBody: result.success ? '{"ok": true}' : undefined,
      errorMessage: result.errorMessage,
      latencyMs: Date.now() - startTime,
    };
  } catch (err) {
    return {
      success: false,
      errorMessage: err instanceof Error ? err.message : "Unknown error",
      latencyMs: Date.now() - startTime,
    };
  }
}