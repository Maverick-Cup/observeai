/**
 * REST JSON / NDJSON Transformer
 */

import type { TransformerAdapter } from "../types";
import type { TransformationResult } from "../../../types/ingestion";

export const restTransformer: TransformerAdapter = {
  name: "rest-json",
  format: "json",

  supports(raw: unknown): boolean {
    if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
      const obj = raw as Record<string, unknown>;
      return typeof obj.traceId === "string" || typeof obj.input === "string";
    }
    if (Array.isArray(raw)) {
      return raw.length > 0 && typeof raw[0] === "object" && raw[0] !== null;
    }
    return false;
  },

  async transform(raw: unknown): Promise<TransformationResult> {
    try {
      if (Array.isArray(raw)) {
        // NDJSON-style batch — process first item as representative
        const first = raw[0] as Record<string, unknown>;
        return buildResult(first);
      }

      const obj = raw as Record<string, unknown>;
      return buildResult(obj);
    } catch (err) {
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : "REST transform failed",
      };
    }
  },
};

function buildResult(obj: Record<string, unknown>): TransformationResult {
  return {
    success: true,
    traceId: (obj.traceId as string) ?? `rest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    spans: [
      {
        name: (obj.model as string) ? `llm.${obj.model}` : "llm.call",
        durationMs: (obj.durationMs as number) ?? 0,
        inputTokens: (obj.inputTokens as number) ?? undefined,
        outputTokens: (obj.outputTokens as number) ?? undefined,
        metadata: {
          ...(obj.metadata as Record<string, unknown> ?? {}),
          input: obj.input,
          output: obj.output,
          tags: obj.tags,
        },
      },
    ],
  };
}