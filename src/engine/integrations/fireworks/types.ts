/**
 * Fireworks AI API response types — mirrors the Fireworks AI REST API.
 */

export interface FireworksAPIError {
  detail: string;
  status: number;
}

// ── GET /v1/models ────────────────────────────────────────────────
export interface FireworksAPIModel {
  id: string;
  object: "model";
  owned_by: string;
  created: number;
  // Non-standard fields returned by Fireworks
  context_length?: number;
  pricing?: {
    input: number;         // per 1M tokens
    output: number;        // per 1M tokens
  };
  type?: string;
}

export interface FireworksModelListResponse {
  object: "list";
  data: FireworksAPIModel[];
}

// ── Chat completions ──────────────────────────────────────────────
export interface FireworksChatCompletionRequest {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
}

export interface FireworksChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: "assistant";
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ── Datasets (train API) ──────────────────────────────────────────
export interface FireworksAPIDataset {
  id: string;
  name: string;
  description?: string;
  row_count: number;
  created_at: string;
  updated_at: string;
  tags?: string[];
  format?: string;
}

export interface FireworksDatasetListResponse {
  data: FireworksAPIDataset[];
}

// ── Fine-tuning jobs ──────────────────────────────────────────────
export interface FireworksAPIFinetuneJob {
  id: string;
  model: string;
  dataset_id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  base_model: string;
  created_at: string;
  completed_at: string | null;
  metrics?: {
    train_loss: number;
    eval_loss: number;
    accuracy: number;
  };
}

export interface FireworksFinetuneListResponse {
  data: FireworksAPIFinetuneJob[];
}

// ── Credit/account info ───────────────────────────────────────────
export interface FireworksAccountResponse {
  id: string;
  name: string;
  credits_remaining?: number;
  credits_total?: number;
}