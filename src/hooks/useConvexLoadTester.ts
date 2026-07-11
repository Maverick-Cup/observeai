import { useState, useRef, useCallback } from "react";
import { convexQuery, convexMutation, isConvexConfigured } from "../lib/convex";

export interface LoadTestResult {
  label: string;
  batchSize: number;
  concurrency: number;
  completed: number;
  errors: number;
  durationMs: number;
  avgLatency: number;
  p50: number;
  p95: number;
  p99: number;
  timestamp: number;
}

export interface LoadTestProgress {
  completed: number;
  errors: number;
  total: number;
  elapsed: number;
}

type RequestType = "query" | "mutation";

export function useConvexLoadTester() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<LoadTestProgress | null>(null);
  const [results, setResults] = useState<LoadTestResult[]>([]);
  const abortRef = useRef(false);
  const configured = isConvexConfigured();

  const runBatch = useCallback(
    async (
      label: string,
      type: RequestType,
      path: string,
      argsFactory: () => Record<string, unknown>,
      batchSize: number,
      concurrency: number,
    ) => {
      if (!configured) return;
      abortRef.current = false;
      setRunning(true);
      setProgress({ completed: 0, errors: 0, total: batchSize, elapsed: 0 });

      const startTime = performance.now();
      const latencies: number[] = [];
      const errors: string[] = [];
      let completed = 0;

      const runner = type === "query" ? convexQuery : convexMutation;

      async function worker() {
        while (completed < batchSize && !abortRef.current) {
          const idx = completed;
          completed++;
          const jobStart = performance.now();
          try {
            await runner(path, argsFactory());
            latencies.push(performance.now() - jobStart);
          } catch (err) {
            latencies.push(performance.now() - jobStart);
            errors.push(`Job ${idx}: ${err instanceof Error ? err.message : "Unknown error"}`);
          }

          setProgress({
            completed,
            errors: errors.length,
            total: batchSize,
            elapsed: performance.now() - startTime,
          });

          // Yield between jobs so the UI can update
          if (idx % 5 === 0) {
            await new Promise((r) => setTimeout(r, 0));
          }
        }
      }

      // Fire workers up to concurrency limit
      const workers = Array.from({ length: Math.min(concurrency, batchSize) }, () => worker());
      await Promise.all(workers);

      const durationMs = performance.now() - startTime;
      const sorted = [...latencies].sort((a, b) => a - b);
      const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
      const p50 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.5)] : 0;
      const p95 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] : 0;
      const p99 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.99)] : 0;

      const result: LoadTestResult = {
        label,
        batchSize,
        concurrency,
        completed: latencies.length,
        errors: errors.length,
        durationMs,
        avgLatency,
        p50,
        p95,
        p99,
        timestamp: Date.now(),
      };

      setResults((prev) => [result, ...prev].slice(0, 20));
      setRunning(false);
      setProgress(null);
    },
    [configured],
  );

  const abort = useCallback(() => {
    abortRef.current = true;
    setRunning(false);
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
  }, []);

  return {
    runBatch,
    abort,
    clearResults,
    running,
    progress,
    results,
    configured,
  };
}