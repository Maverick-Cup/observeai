import { useState, useCallback } from "react";
import type { Trace, DashboardStats } from "../types";

const STORAGE_KEY = "observeai-synthetic-traces";

export interface SyntheticConfig {
  count: number;
  modelMix: { name: string; provider: string; weight: number }[];
  errorRate: number; // 0–1
  daysBack: number;
  minCost: number;
  maxCost: number;
  includeEvaluations: boolean;
  includeSpans: boolean;
}

const MODELS = [
  { name: "GPT-4o", provider: "OpenAI", weight: 0.35 },
  { name: "Claude 3.5 Sonnet", provider: "Anthropic", weight: 0.25 },
  { name: "GPT-3.5 Turbo", provider: "OpenAI", weight: 0.15 },
  { name: "Llama 3 70B", provider: "Meta", weight: 0.10 },
  { name: "Gemini 1.5 Pro", provider: "Google", weight: 0.08 },
  { name: "Mistral Large", provider: "Mistral", weight: 0.07 },
];

const STATUSES: Array<"success" | "error" | "partial"> = ["success", "error", "partial"];

const QUERIES = [
  "What are the side effects of ibuprofen?",
  "How do I reset my password?",
  "Explain quantum computing in simple terms",
  "What's the weather forecast for tomorrow?",
  "Can you draft an email to my team about Q3 goals?",
  "What is the capital of Ethiopia?",
  "Summarize this article for me",
  "How do I configure a reverse proxy in Nginx?",
  "What are the best practices for React state management?",
  "Translate 'hello' to Spanish",
  "What's the difference between AI and ML?",
  "Help me debug this error: TypeError: Cannot read property 'map' of undefined",
  "Write a Python script to sort a CSV file",
  "What is the meaning of life?",
  "Can you review my code?",
  "How do I deploy a Docker container to AWS ECS?",
  "Tell me a joke",
  "What is the stock price of Apple?",
  "Explain the law of supply and demand",
  "Generate a meal plan for a vegetarian athlete",
  "How does blockchain work?",
  "What are the symptoms of COVID-19?",
  "Write a haiku about programming",
  "How do I optimize a SQL query?",
  "Create a budget spreadsheet template",
];

const RESPONSES = [
  "Based on the available information, ibuprofen can cause gastrointestinal side effects including dyspepsia, heartburn, and nausea...",
  "Here's how to reset your password: go to Settings > Security > Reset Password, enter your email...",
  "Quantum computing leverages superposition and entanglement to perform computations exponentially faster for certain problems...",
  "Here is a detailed explanation of the topic based on current knowledge...",
  "The requested information is provided below with relevant context and sources...",
];

function pickWeighted<T>(items: { value: T; weight: number }[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(randBetween(min, max + 1));
}

export function useSyntheticData() {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const generate = useCallback(
    async (config: SyntheticConfig): Promise<Trace[]> => {
      setGenerating(true);
      setProgress(0);

      const traces: Trace[] = [];
      const batchSize = Math.max(1, Math.floor(config.count / 20));
      const now = Date.now();

      for (let i = 0; i < config.count; i++) {
        const model = pickWeighted(config.modelMix.map((m) => ({ value: m, weight: m.weight })));
        const isError = Math.random() < config.errorRate;
        const status = isError
          ? ("error" as const)
          : Math.random() < 0.03
            ? ("partial" as const)
            : ("success" as const);
        const latencyMs = status === "error"
          ? randBetween(500, 8000)
          : randBetween(80, 3000);
        const promptTokens = randInt(100, 2000);
        const completionTokens = randInt(50, 1200);
        const costUsd = randBetween(config.minCost, config.maxCost);
        const createdAt = now - randBetween(0, config.daysBack * 86400000);

        const trace: Trace = {
          _id: `syn_${Date.now()}_${i}`,
          _creationTime: createdAt,
          traceId: `trace_synthetic_${i}_${Math.random().toString(36).slice(2, 8)}`,
          projectId: "stress-test-project",
          organizationId: "org-stress",
          model: model.name,
          modelProvider: model.provider,
          userQuery: QUERIES[i % QUERIES.length],
          response: RESPONSES[i % RESPONSES.length],
          latencyMs,
          tokenCount: promptTokens + completionTokens,
          promptTokens,
          completionTokens,
          costUsd,
          status,
          environment: Math.random() < 0.7 ? "production" : "staging",
          createdAt,
          updatedAt: createdAt + 1000,
          evaluation: config.includeEvaluations
            ? {
                _id: `eval_${i}`,
                _creationTime: createdAt,
                traceId: `trace_synthetic_${i}`,
                scorerType: "heuristic",
                faithfulness: Math.max(0, Math.min(1, 0.9 + (Math.random() - 0.5) * 0.15)),
                relevance: Math.max(0, Math.min(1, 0.85 + (Math.random() - 0.5) * 0.2)),
                safety: Math.max(0, Math.min(1, 0.95 + (Math.random() - 0.5) * 0.08)),
                overallScore: 0,
                createdAt,
              }
            : null,
          feedback: null,
          alertCount: isError ? randInt(1, 4) : 0,
          metadata: {},
        };

        if (trace.evaluation) {
          trace.evaluation.overallScore =
            (trace.evaluation.faithfulness + trace.evaluation.relevance + trace.evaluation.safety) / 3;
        }

        traces.push(trace);

        // Update progress every batch
        if (i % batchSize === 0) {
          setProgress(Math.round((i / config.count) * 100));
          // Yield to the event loop so the UI updates
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      setProgress(100);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(traces));
      setGenerating(false);
      return traces;
    },
    [],
  );

  const clearData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const loadData = useCallback((): Trace[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Trace[]) : [];
    } catch {
      return [];
    }
  }, []);

  const computeStats = useCallback((traces: Trace[]): DashboardStats | null => {
    if (traces.length === 0) return null;

    const successTraces = traces.filter((t) => t.status === "success").length;
    const errorTraces = traces.filter((t) => t.status === "error").length;
    const partialTraces = traces.filter((t) => t.status === "partial").length;
    const avgLatency =
      traces.reduce((s, t) => s + (t.latencyMs ?? 0), 0) / traces.length;
    const totalTokens = traces.reduce((s, t) => s + (t.tokenCount ?? 0), 0);
    const totalCost = traces.reduce((s, t) => s + (t.costUsd ?? 0), 0);
    const avgAccuracy = traces.reduce((s, t) => {
      const score = t.evaluation?.overallScore ?? 1;
      return s + score;
    }, 0) / traces.length;

    // Time series buckets (by day)
    const dayBuckets = new Map<string, { count: number; errors: number; cost: number }>();
    traces.forEach((t) => {
      const day = new Date(t.createdAt).toISOString().slice(0, 10);
      const b = dayBuckets.get(day) ?? { count: 0, errors: 0, cost: 0 };
      b.count++;
      if (t.status === "error") b.errors++;
      b.cost += t.costUsd ?? 0;
      dayBuckets.set(day, b);
    });
    const timeSeries = Array.from(dayBuckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));

    // Model distribution
    const modelCounts = new Map<string, number>();
    traces.forEach((t) => {
      const name = t.model ?? "unknown";
      modelCounts.set(name, (modelCounts.get(name) ?? 0) + 1);
    });
    const modelDistribution = Array.from(modelCounts.entries()).map(([name, count]) => ({
      name,
      count,
      percentage: count / traces.length,
    }));

    // Latency buckets
    const latencyBuckets = [
      { label: "0-100ms", min: 0, max: 100, count: 0 },
      { label: "100-500ms", min: 100, max: 500, count: 0 },
      { label: "500-1s", min: 500, max: 1000, count: 0 },
      { label: "1-3s", min: 1000, max: 3000, count: 0 },
      { label: "3s+", min: 3000, max: Infinity, count: 0 },
    ];
    traces.forEach((t) => {
      const lat = t.latencyMs ?? 0;
      for (const b of latencyBuckets) {
        if (lat >= b.min && lat < b.max) {
          b.count++;
          break;
        }
      }
    });

    return {
      totalTraces: traces.length,
      errorTraces,
      partialTraces,
      successTraces,
      avgLatency,
      totalTokens,
      totalCost,
      errorRate: errorTraces / traces.length,
      averageAccuracy: avgAccuracy,
      alertCount: traces.filter((t) => (t.alertCount ?? 0) > 0).length,
      timeSeries,
      modelDistribution,
      latencyBuckets,
    };
  }, []);

  return { generate, clearData, loadData, computeStats, generating, progress };
}