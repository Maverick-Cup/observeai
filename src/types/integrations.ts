/**
 * Integration types — providers, datasets, and connection configs for ObserveAI.
 */

export type IntegrationProvider = "fireworks" | "openai" | "anthropic" | "openrouter";

export interface IntegrationConfig {
  provider: IntegrationProvider;
  label: string;
  apiKey?: string;
  baseUrl?: string;
  enabled: boolean;
  connectedAt: number | null;
  metadata?: Record<string, string>;
}

export interface FireworksModel {
  id: string;
  name: string;
  provider: string;
  type: "chat" | "completion" | "image" | "embedding";
  contextWindow: number;
  pricing: {
    inputPerMillion: number;
    outputPerMillion: number;
  };
}

export interface FireworksDataset {
  id: string;
  name: string;
  description: string;
  rowCount: number;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  format: "jsonl" | "csv";
}

export interface FireworksFinetuneJob {
  id: string;
  model: string;
  datasetId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  baseModel: string;
  createdAt: number;
  completedAt: number | null;
  metrics?: {
    trainLoss: number;
    evalLoss: number;
    accuracy: number;
  };
}

// Fireworks AI available models (as of latest)
export const FIREWORKS_MODELS: FireworksModel[] = [
  { id: "accounts/fireworks/models/llama-v3p3-70b-instruct", name: "Llama 3.3 70B", provider: "Meta", type: "chat", contextWindow: 128000, pricing: { inputPerMillion: 0.90, outputPerMillion: 0.90 } },
  { id: "accounts/fireworks/models/llama-v3p1-405b-instruct", name: "Llama 3.1 405B", provider: "Meta", type: "chat", contextWindow: 128000, pricing: { inputPerMillion: 3.00, outputPerMillion: 3.00 } },
  { id: "accounts/fireworks/models/llama-v3p1-70b-instruct", name: "Llama 3.1 70B", provider: "Meta", type: "chat", contextWindow: 128000, pricing: { inputPerMillion: 0.90, outputPerMillion: 0.90 } },
  { id: "accounts/fireworks/models/llama-v3p1-8b-instruct", name: "Llama 3.1 8B", provider: "Meta", type: "chat", contextWindow: 128000, pricing: { inputPerMillion: 0.20, outputPerMillion: 0.20 } },
  { id: "accounts/fireworks/models/deepseek-v3", name: "DeepSeek V3", provider: "DeepSeek", type: "chat", contextWindow: 65536, pricing: { inputPerMillion: 0.60, outputPerMillion: 0.60 } },
  { id: "accounts/fireworks/models/mixtral-8x22b-instruct", name: "Mixtral 8x22B", provider: "Mistral", type: "chat", contextWindow: 65536, pricing: { inputPerMillion: 0.50, outputPerMillion: 0.50 } },
  { id: "accounts/fireworks/models/qwen2p5-72b-instruct", name: "Qwen 2.5 72B", provider: "Alibaba", type: "chat", contextWindow: 32768, pricing: { inputPerMillion: 0.90, outputPerMillion: 0.90 } },
  { id: "accounts/fireworks/models/deepseek-r1", name: "DeepSeek R1", provider: "DeepSeek", type: "chat", contextWindow: 65536, pricing: { inputPerMillion: 2.00, outputPerMillion: 2.00 } },
];

// Mock datasets from Fireworks Hub
export const FIREWORKS_DATASETS: FireworksDataset[] = [
  { id: "ds_k8x7m3", name: "llama-3-instructions-500", description: "500 curated instruction-following examples for Llama 3 eval", rowCount: 500, createdAt: Date.now() - 86400000 * 3, updatedAt: Date.now() - 86400000, tags: ["instruction", "llama", "eval"], format: "jsonl" },
  { id: "ds_v4n9q2", name: "prompt-injection-test-set", description: "Benchmark prompt injection attempts across categories", rowCount: 250, createdAt: Date.now() - 86400000 * 14, updatedAt: Date.now() - 86400000 * 2, tags: ["security", "injection", "red-team"], format: "jsonl" },
  { id: "ds_b3m5k8", name: "customer-support-qa", description: "Real customer support Q&A pairs from e-commerce domain", rowCount: 1200, createdAt: Date.now() - 86400000 * 30, updatedAt: Date.now() - 86400000 * 5, tags: ["customer-support", "qa", "domain-specific"], format: "jsonl" },
  { id: "ds_t6r1p4", name: "json-mode-stress-test", description: "200 edge cases for JSON structured output validation", rowCount: 200, createdAt: Date.now() - 86400000 * 7, updatedAt: Date.now() - 86400000, tags: ["json", "structured-output", "edge-cases"], format: "jsonl" },
];

// Mock fine-tuning jobs
export const FIREWORKS_FINETUNE_JOBS: FireworksFinetuneJob[] = [
  { id: "ft_abc123", model: "llama-v3p1-8b-instruct-f1", datasetId: "ds_k8x7m3", status: "completed", progress: 100, baseModel: "accounts/fireworks/models/llama-v3p1-8b-instruct", createdAt: Date.now() - 86400000 * 10, completedAt: Date.now() - 86400000 * 8, metrics: { trainLoss: 0.32, evalLoss: 0.41, accuracy: 0.88 } },
  { id: "ft_def456", model: "mixtral-8x22b-instruct-f1", datasetId: "ds_b3m5k8", status: "running", progress: 62, baseModel: "accounts/fireworks/models/mixtral-8x22b-instruct", createdAt: Date.now() - 86400000 * 2, completedAt: null },
  { id: "ft_ghi789", model: "deepseek-v3-f1", datasetId: "ds_t6r1p4", status: "failed", progress: 23, baseModel: "accounts/fireworks/models/deepseek-v3", createdAt: Date.now() - 86400000 * 5, completedAt: Date.now() - 86400000 * 4, metrics: { trainLoss: 2.1, evalLoss: 1.8, accuracy: 0.45 } },
];