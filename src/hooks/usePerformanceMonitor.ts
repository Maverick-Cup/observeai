import { useRef, useCallback, Profiler, createElement, type ProfilerOnRenderCallback } from "react";

export interface PerformanceEntry {
  id: string;
  phase: "mount" | "update";
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
  timestamp: number;
}

export interface ComponentStats {
  renderCount: number;
  totalDuration: number;
  avgDuration: number;
  maxDuration: number;
  mountDuration: number;
  lastRender: number;
}

const listeners = new Set<(entry: PerformanceEntry) => void>();

export function onPerformanceEntry(cb: (entry: PerformanceEntry) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function broadcast(entry: PerformanceEntry) {
  listeners.forEach((cb) => cb(entry));
}

/**
 * Wrap any component subtree with this Profiler.
 * Usage: <PerformanceProfiler id="Dashboard"><Dashboard /></PerformanceProfiler>
 */
export function PerformanceProfiler({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const handleRender: ProfilerOnRenderCallback = useCallback(
    (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
      broadcast({
        id: id as string,
        phase: phase as "mount" | "update",
        actualDuration,
        baseDuration,
        startTime,
        commitTime,
        timestamp: Date.now(),
      });
    },
    [],
  );

  return createElement(Profiler, { id, onRender: handleRender }, children);
}

/**
 * Hook that collects and aggregates Profiler data.
 */
export function usePerformanceMonitor() {
  const entriesRef = useRef<PerformanceEntry[]>([]);
  const statsRef = useRef<Map<string, ComponentStats>>(new Map());

  const subscribe = useCallback(() => {
    const unsub = onPerformanceEntry((entry) => {
      entriesRef.current.push(entry);

      const prev = statsRef.current.get(entry.id) ?? {
        renderCount: 0,
        totalDuration: 0,
        avgDuration: 0,
        maxDuration: 0,
        mountDuration: 0,
        lastRender: 0,
      };

      prev.renderCount++;
      prev.totalDuration += entry.actualDuration;
      prev.avgDuration = prev.totalDuration / prev.renderCount;
      prev.maxDuration = Math.max(prev.maxDuration, entry.actualDuration);
      prev.lastRender = entry.timestamp;

      if (entry.phase === "mount") {
        prev.mountDuration = entry.actualDuration;
      }

      statsRef.current.set(entry.id, prev);
    });

    return unsub;
  }, []);

  const clearEntries = useCallback(() => {
    entriesRef.current = [];
    statsRef.current.clear();
  }, []);

  const getStats = useCallback((): Map<string, ComponentStats> => {
    return new Map(statsRef.current);
  }, []);

  const getEntries = useCallback((): PerformanceEntry[] => {
    return [...entriesRef.current];
  }, []);

  return {
    subscribe,
    clearEntries,
    getStats,
    getEntries,
    PerformanceProfiler,
  };
}