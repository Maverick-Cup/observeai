/**
 * CSV / Flat File Transformer
 *
 * Parses CSV rows and converts them into ObserveAI trace events.
 * Supports standard CSV with headers, and auto-detects common column names.
 */

import type { TransformerAdapter } from "../types";
import type { TransformationResult } from "../../../types/ingestion";

// ── CSV Parsing (lightweight, no external dep) ──────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function tryParseNumber(val: string): number | string {
  const num = Number(val);
  return isNaN(num) ? val : num;
}

// ── Column mapping ──────────────────────────────────────────────

interface ColumnMap {
  query: string[];
  response: string[];
  model: string[];
  latency: string[];
  tokens: string[];
  cost: string[];
  flagged: string[];
  user: string[];
  timestamp: string[];
  tags: string[];
}

const COMMON_COLUMNS: ColumnMap = {
  query: ["query", "question", "prompt", "input", "user_query", "user_question", "message"],
  response: ["response", "answer", "output", "reply", "completion", "ai_response", "generated_text"],
  model: ["model", "model_name", "llm", "model_id", "engine"],
  latency: ["latency", "duration_ms", "duration", "time_ms", "response_time", "latency_ms"],
  tokens: ["tokens", "total_tokens", "token_count", "token_usage", "tokens_used"],
  cost: ["cost", "cost_usd", "price", "expense", "total_cost"],
  flagged: ["flagged", "flagged?", "is_flagged", "harmful", "toxic", "blocked"],
  user: ["user", "user_id", "customer_id", "user_email", "username"],
  timestamp: ["timestamp", "date", "time", "created_at", "datetime"],
  tags: ["tags", "labels", "categories", "tag"],
};

function detectColumn(headers: string): ColumnMap {
  const cols = parseCSVLine(headers).map((h) => h.toLowerCase().replace(/['"]/g, ""));
  const map: Record<string, string | undefined> = {};

  for (const [field, aliases] of Object.entries(COMMON_COLUMNS)) {
    for (const alias of aliases) {
      const idx = cols.indexOf(alias);
      if (idx >= 0) {
        map[field] = cols[idx];
        break;
      }
    }
  }

  // Map remaining columns as metadata
  return {
    query: [map.query ?? cols[0] ?? "query"],
    response: [map.response ?? cols[1] ?? "response"],
    model: [map.model ?? ""],
    latency: [map.latency ?? ""],
    tokens: [map.tokens ?? ""],
    cost: [map.cost ?? ""],
    flagged: [map.flagged ?? ""],
    user: [map.user ?? ""],
    timestamp: [map.timestamp ?? ""],
    tags: [map.tags ?? ""],
  };
}

function rowToObject(headers: string[], values: string[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (let i = 0; i < headers.length && i < values.length; i++) {
    obj[headers[i].trim()] = tryParseNumber(values[i]);
  }
  return obj;
}

// ── Transformer ────────────────────────────────────────────────

export const csvTransformer: TransformerAdapter = {
  name: "csv",
  format: "csv",

  supports(raw: unknown): boolean {
    if (typeof raw !== "string") return false;
    const lines = raw.trim().split("\n");
    return lines.length >= 2 && lines[0].includes(",");
  },

  async transform(raw: unknown): Promise<TransformationResult> {
    try {
      if (typeof raw !== "string") {
        return { success: false, errorMessage: "CSV input must be a string" };
      }

      const lines = raw.trim().split("\n").filter((l) => l.trim());
      if (lines.length < 2) {
        return { success: false, errorMessage: "CSV must have a header row and at least one data row" };
      }

      const headers = parseCSVLine(lines[0]);
      const columnMap = detectColumn(lines[0]);
      const queryCol = columnMap.query[0];

      // Find first data row that has a query value
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length < headers.length) continue;

        const obj = rowToObject(headers, values);
        const query = obj[queryCol];

        if (query && String(query).trim()) {
          const flagged = columnMap.flagged[0] ? obj[columnMap.flagged[0]] : undefined;
          const flaggedBool = typeof flagged === "string"
            ? ["true", "yes", "1", "flagged", "toxic", "harmful"].includes(flagged.toLowerCase())
            : Boolean(flagged);

          return {
            success: true,
            traceId: `csv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            spans: [
              {
                name: columnMap.model[0] && obj[columnMap.model[0]]
                  ? `llm.${obj[columnMap.model[0]]}`
                  : "llm.csv_import",
                durationMs: columnMap.latency[0] ? (obj[columnMap.latency[0]] as number) ?? 0 : 0,
                inputTokens: columnMap.tokens[0] ? (obj[columnMap.tokens[0]] as number) ?? undefined : undefined,
                outputTokens: undefined,
                metadata: {
                  source: "csv_import",
                  query: String(query),
                  response: columnMap.response[0] ? String(obj[columnMap.response[0]] ?? "") : "",
                  model: columnMap.model[0] ? obj[columnMap.model[0]] : undefined,
                  user: columnMap.user[0] ? obj[columnMap.user[0]] : undefined,
                  cost: columnMap.cost[0] ? obj[columnMap.cost[0]] : undefined,
                  flagged: flaggedBool,
                  tags: columnMap.tags[0] ? obj[columnMap.tags[0]] : undefined,
                  rawRow: values,
                },
              },
            ],
          };
        }
      }

      return { success: false, errorMessage: "No valid data rows found in CSV" };
    } catch (err) {
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : "CSV transform failed",
      };
    }
  },
};