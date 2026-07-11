/**
 * Fireworks AI API client — wraps every Fireworks REST endpoint used by ObserveAI.
 *
 * All methods return typed responses or throw a structured error.
 * The client is instantiated per API key so concurrent connections
 * (e.g. different providers) don't share state.
 */

import type {
  FireworksModelListResponse,
  FireworksChatCompletionRequest,
  FireworksChatCompletionResponse,
  FireworksDatasetListResponse,
  FireworksAPIDataset,
  FireworksFinetuneListResponse,
  FireworksAPIFinetuneJob,
  FireworksAPIError,
} from "./types";

// ── Constants ─────────────────────────────────────────────────────
const DEFAULT_BASE_URL = "https://api.fireworks.ai/inference/v1";
const REQUEST_TIMEOUT_MS = 15_000;

// ── Error class ───────────────────────────────────────────────────
export class FireworksClientError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(`Fireworks API error (${status}): ${detail}`);
    this.name = "FireworksClientError";
    this.status = status;
    this.detail = detail;
  }
}

// ── Client ────────────────────────────────────────────────────────
export class FireworksClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string, baseUrl?: string) {
    if (!apiKey) throw new FireworksClientError(401, "API key is required");
    this.apiKey = apiKey;
    this.baseUrl = (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
  }

  /** Shared fetch wrapper with auth, timeout, and error handling */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorBody: FireworksAPIError | { detail?: string } =
          await res.json().catch(() => ({ detail: res.statusText }));
        throw new FireworksClientError(
          res.status,
          (errorBody as { detail?: string }).detail || res.statusText,
        );
      }

      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof FireworksClientError) throw err;
      if ((err as Error).name === "AbortError") {
        throw new FireworksClientError(408, "Request timed out");
      }
      throw new FireworksClientError(
        0,
        (err as Error).message || "Network error",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  // ── Models ──────────────────────────────────────────────────

  /** List all available Fireworks models with metadata. */
  async listModels(): Promise<FireworksModelListResponse> {
    return this.request<FireworksModelListResponse>("GET", "/models");
  }

  /** Check if a specific model ID is accessible. */
  async checkModelAccess(modelId: string): Promise<boolean> {
    try {
      const models = await this.listModels();
      return models.data.some((m) => m.id === modelId);
    } catch {
      return false;
    }
  }

  // ── Chat completions ────────────────────────────────────────

  /** Send a chat completion request — used for test traces. */
  async chatCompletion(
    req: FireworksChatCompletionRequest,
  ): Promise<FireworksChatCompletionResponse> {
    return this.request<FireworksChatCompletionResponse>(
      "POST",
      "/chat/completions",
      req,
    );
  }

  // ── Datasets ────────────────────────────────────────────────

  /** List datasets accessible by this API key. */
  async listDatasets(): Promise<FireworksAPIDataset[]> {
    try {
      const res = await this.request<FireworksDatasetListResponse>(
        "GET",
        "/train/datasets",
      );
      return res.data ?? [];
    } catch (err) {
      // Some API tiers may not have dataset access; return empty gracefully
      if (err instanceof FireworksClientError && err.status === 404) {
        return [];
      }
      throw err;
    }
  }

  /** Fetch dataset content rows (first N rows). */
  async fetchDatasetRows(
    datasetId: string,
    limit = 100,
  ): Promise<Record<string, unknown>[]> {
    return this.request<Record<string, unknown>[]>(
      "GET",
      `/train/datasets/${datasetId}/rows?limit=${limit}`,
    );
  }

  // ── Fine-tuning ─────────────────────────────────────────────

  /** List all fine-tuning jobs. */
  async listFinetuneJobs(): Promise<FireworksAPIFinetuneJob[]> {
    try {
      const res = await this.request<FireworksFinetuneListResponse>(
        "GET",
        "/train/fine_tunes",
      );
      return res.data ?? [];
    } catch (err) {
      if (err instanceof FireworksClientError && err.status === 404) {
        return [];
      }
      throw err;
    }
  }

  /** Get a single fine-tuning job detail. */
  async getFinetuneJob(
    jobId: string,
  ): Promise<FireworksAPIFinetuneJob | null> {
    try {
      return await this.request<FireworksAPIFinetuneJob>(
        "GET",
        `/train/fine_tunes/${jobId}`,
      );
    } catch {
      return null;
    }
  }

  // ── Account / health ────────────────────────────────────────

  /** Quick connectivity check — pings the models endpoint. */
  async healthCheck(): Promise<boolean> {
    try {
      await this.listModels();
      return true;
    } catch {
      return false;
    }
  }
}

// ── Singleton factory (for demo/localStorage key management) ──────
let activeClient: FireworksClient | null = null;

export function getFireworksClient(): FireworksClient | null {
  return activeClient;
}

export function setActiveFireworksClient(apiKey: string): FireworksClient {
  activeClient = new FireworksClient(apiKey);
  return activeClient;
}

export function clearActiveFireworksClient(): void {
  activeClient = null;
}