/**
 * In-Memory Ingestion Store
 *
 * Production would use Convex / Postgres. This mock store supports
 * the demo UI and engine workflows.
 */

import type { IngestEvent, IngestBatch, IngestPipelineStats } from "../../types/ingestion";
import type { IngestStore } from "./types";

export function createMemoryStore(): IngestStore {
  const events = new Map<string, IngestEvent>();
  const batches = new Map<string, IngestBatch>();

  return {
    async saveEvent(event: IngestEvent): Promise<void> {
      events.set(event.id, event);
    },

    async saveBatch(batch: IngestBatch): Promise<void> {
      batches.set(batch.id, batch);
    },

    async getEvent(id: string): Promise<IngestEvent | null> {
      return events.get(id) ?? null;
    },

    async getBatch(id: string): Promise<IngestBatch | null> {
      return batches.get(id) ?? null;
    },

    async getStats(): Promise<IngestPipelineStats> {
      const allEvents = Array.from(events.values());
      const allBatches = Array.from(batches.values());

      const completed = allEvents.filter((e) => e.status === "completed");
      const failed = allEvents.filter((e) => e.status === "failed");
      const rejected = allEvents.filter((e) => e.status === "rejected");

      const totalLatency = completed.reduce((sum, e) => sum + (e.processingLatencyMs ?? 0), 0);
      const avgLatency = completed.length > 0 ? Math.round(totalLatency / completed.length) : 0;

      // P95 latency
      const latencies = completed
        .map((e) => e.processingLatencyMs ?? 0)
        .sort((a, b) => a - b);
      const p95Idx = Math.floor(latencies.length * 0.95);
      const p95Latency = latencies.length > 0 ? latencies[p95Idx] : 0;

      // Error frequency
      const errorCounts = new Map<string, number>();
      for (const e of failed) {
        const msg = e.errorMessage ?? "Unknown error";
        errorCounts.set(msg, (errorCounts.get(msg) ?? 0) + 1);
      }
      const topErrors = Array.from(errorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([message, count]) => ({ message, count }));

      // Integration stats
      const integrationMap = new Map<string, { name: string; source: string; events24h: number; errorRate: number; lastEventAt?: number }>();
      const now = Date.now();
      const oneDayAgo = now - 86400000;

      for (const e of allEvents) {
        if (e.receivedAt < oneDayAgo) continue;
        const key = e.source;
        const entry = integrationMap.get(key) ?? {
          name: `${e.source}`,
          source: e.source,
          events24h: 0,
          errorRate: 0,
          lastEventAt: undefined,
        };
        entry.events24h++;
        if (e.status === "failed" || e.status === "rejected") {
          entry.errorRate++;
        }
        if (!entry.lastEventAt || e.receivedAt > entry.lastEventAt) {
          entry.lastEventAt = e.receivedAt;
        }
        integrationMap.set(key, entry);
      }

      // Calculate error rates as percentages
      const integrations = Array.from(integrationMap.values()).map((i) => ({
        ...i,
        errorRate: i.events24h > 0 ? Math.round((i.errorRate / i.events24h) * 100) : 0,
      }));

      // Throughput (events per minute in last 5 min)
      const fiveMinAgo = now - 300000;
      const recentEvents = allEvents.filter((e) => e.receivedAt >= fiveMinAgo);
      const throughputPerMinute = Math.round(recentEvents.length / 5);

      return {
        totalReceived: allEvents.length,
        totalCompleted: completed.length,
        totalFailed: failed.length,
        totalRejected: rejected.length,
        avgLatencyMs: avgLatency,
        p95LatencyMs: p95Latency,
        throughputPerMinute,
        topErrors,
        integrations,
      };
    },

    async listRecentEvents(limit = 50): Promise<IngestEvent[]> {
      return Array.from(events.values())
        .sort((a, b) => b.receivedAt - a.receivedAt)
        .slice(0, limit);
    },

    async listBatches(limit = 20): Promise<IngestBatch[]> {
      return Array.from(batches.values())
        .sort((a, b) => b.receivedAt - a.receivedAt)
        .slice(0, limit);
    },
  };
}

// Singleton instance
export const ingestStore = createMemoryStore();