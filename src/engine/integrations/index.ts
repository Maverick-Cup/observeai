/**
 * Integration registry — single point of discovery for all providers.
 * Add new providers here when wiring up future integrations.
 */

import {
  FireworksClient,
  setActiveFireworksClient,
  clearActiveFireworksClient,
  FireworksClientError,
} from "./fireworks";

export type IntegrationProviderId = "fireworks" | "openai" | "anthropic" | "openrouter";

export interface IntegrationProviderInfo {
  id: IntegrationProviderId;
  label: string;
  description: string;
  docsUrl: string;
  connected: boolean;
}

export interface IntegrationConnectionResult {
  success: boolean;
  error?: string;
}

// ── Active client store ───────────────────────────────────────────
const activeClients: Partial<Record<IntegrationProviderId, FireworksClient>> = {};

export function getClient(provider: IntegrationProviderId): FireworksClient | null {
  return activeClients[provider] ?? null;
}

// ── Provider registry ─────────────────────────────────────────────
export const AVAILABLE_PROVIDERS: IntegrationProviderInfo[] = [
  {
    id: "fireworks",
    label: "Fireworks AI",
    description: "High-throughput LLM inference, dataset hosting, and fine-tuning",
    docsUrl: "https://docs.fireworks.ai",
    connected: false,
  },
];

// ── Connection management ─────────────────────────────────────────

export async function connectProvider(
  provider: IntegrationProviderId,
  apiKey: string,
): Promise<IntegrationConnectionResult> {
  try {
    const client = new FireworksClient(apiKey);
    const healthy = await client.healthCheck();
    if (!healthy) {
      return { success: false, error: "Could not reach provider API" };
    }
    activeClients[provider] = client;
    return { success: true };
  } catch (err) {
    const message =
      err instanceof FireworksClientError
        ? err.detail
        : (err as Error).message || "Connection failed";
    return { success: false, error: message };
  }
}

export function disconnectProvider(
  provider: IntegrationProviderId,
): void {
  delete activeClients[provider];
  if (provider === "fireworks") {
    clearActiveFireworksClient();
  }
}