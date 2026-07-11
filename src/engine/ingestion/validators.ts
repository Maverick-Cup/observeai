/**
 * Ingestion Schema Validators
 */

import type { ValidationResult, IngestionFormat } from "../../types/ingestion";

// ── Field-level validators ────────────────────────────────────────

function isString(val: unknown): val is string {
  return typeof val === "string";
}

function isNumber(val: unknown): val is number {
  return typeof val === "number" && !Number.isNaN(val);
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function isStringArray(val: unknown): val is string[] {
  return Array.isArray(val) && val.every((v) => typeof v === "string");
}

// ── Validation Rules ──────────────────────────────────────────────

interface ValidationRule {
  field: string;
  label: string;
  type: "string" | "number" | "object" | "string[]" | "optional_string" | "optional_number" | "optional_object";
  required: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
}

const BASE_TRACE_RULES: ValidationRule[] = [
  { field: "traceId", label: "Trace ID", type: "string", required: true, min: 1, max: 128 },
  { field: "model", label: "Model name", type: "optional_string", required: false },
  { field: "input", label: "Input prompt", type: "optional_string", required: false },
  { field: "output", label: "Output response", type: "optional_string", required: false },
  { field: "durationMs", label: "Duration (ms)", type: "optional_number", required: false, min: 0 },
  { field: "inputTokens", label: "Input tokens", type: "optional_number", required: false, min: 0 },
  { field: "outputTokens", label: "Output tokens", type: "optional_number", required: false, min: 0 },
  { field: "costUsd", label: "Cost (USD)", type: "optional_number", required: false, min: 0 },
  { field: "tags", label: "Tags", type: "string[]", required: false },
  { field: "metadata", label: "Metadata", type: "optional_object", required: false },
];

const JSON_RULES = [...BASE_TRACE_RULES];

const NDJSON_RULES = [...BASE_TRACE_RULES];

const SYSLOG_RULES: ValidationRule[] = [
  { field: "timestamp", label: "Timestamp", type: "number", required: true },
  { field: "hostname", label: "Hostname", type: "string", required: true, min: 1 },
  { field: "appName", label: "Application name", type: "string", required: true },
  { field: "message", label: "Message", type: "string", required: true },
  { field: "facility", label: "Facility", type: "optional_number", required: false },
  { field: "severity", label: "Severity", type: "optional_number", required: false },
];

const OTEL_RULES: ValidationRule[] = [
  { field: "traceId", label: "Trace ID", type: "string", required: true, min: 1 },
  { field: "spanId", label: "Span ID", type: "string", required: true, min: 1 },
  { field: "name", label: "Span name", type: "string", required: true },
  { field: "parentSpanId", label: "Parent Span ID", type: "optional_string", required: false },
  { field: "startTime", label: "Start time", type: "number", required: true },
  { field: "endTime", label: "End time", type: "number", required: true },
  { field: "attributes", label: "Attributes", type: "optional_object", required: false },
];

const CSV_RULES: ValidationRule[] = [
  { field: "query", label: "User query", type: "string", required: true },
  { field: "response", label: "AI response", type: "optional_string", required: false },
  { field: "model", label: "Model", type: "optional_string", required: false },
  { field: "latency", label: "Latency (ms)", type: "optional_number", required: false, min: 0 },
  { field: "tokens", label: "Token count", type: "optional_number", required: false, min: 0 },
  { field: "flagged", label: "Flagged (true/false)", type: "optional_string", required: false },
];

const FORMAT_RULES: Record<IngestionFormat, ValidationRule[]> = {
  json: JSON_RULES,
  ndjson: NDJSON_RULES,
  syslog: SYSLOG_RULES,
  otel: OTEL_RULES,
  csv: CSV_RULES,
  raw: [{ field: "raw", label: "Raw payload", type: "string", required: true }],
};

// ── Coerce value to expected type ──────────────────────────────

function coerce(value: unknown, type: ValidationRule["type"]): unknown {
  if (value === undefined || value === null) return undefined;
  if (type === "optional_string" || type === "string") {
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    if (typeof value === "boolean") return String(value);
    return undefined;
  }
  if (type === "optional_number" || type === "number") {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }
  return value;
}

// ── Main validator ────────────────────────────────────────────────

export function validatePayload(
  payload: Record<string, unknown>,
  format: IngestionFormat,
): ValidationResult {
  const rules = FORMAT_RULES[format];
  if (!rules) {
    return {
      valid: false,
      errors: [{ field: "_format", message: `Unknown format: ${format}`, severity: "error" }],
    };
  }

  const errors: ValidationResult["errors"] = [];

  for (const rule of rules) {
    const rawValue = payload[rule.field];
    const isOptional = rule.type.startsWith("optional_");
    const coerced = coerce(rawValue, rule.type);

    // Check required
    if (rule.required && (rawValue === undefined || rawValue === null || rawValue === "")) {
      errors.push({
        field: rule.field,
        message: `Missing required field: ${rule.label}`,
        severity: "error",
      });
      continue;
    }

    if (rawValue === undefined || rawValue === null) continue;

    // Type check for non-optional types
    if (!isOptional) {
      const effectiveType = rule.type as "string" | "number" | "object" | "string[]";
      if (effectiveType === "string" && !isString(rawValue)) {
        errors.push({ field: rule.field, message: `${rule.label} must be a string`, severity: "error" });
      } else if (effectiveType === "number" && !isNumber(rawValue)) {
        errors.push({ field: rule.field, message: `${rule.label} must be a number`, severity: "error" });
      } else if (effectiveType === "object" && !isObject(rawValue)) {
        errors.push({ field: rule.field, message: `${rule.label} must be an object`, severity: "error" });
      } else if (effectiveType === "string[]" && !isStringArray(rawValue)) {
        errors.push({ field: rule.field, message: `${rule.label} must be an array of strings`, severity: "error" });
      }
    }

    // Length / range checks
    if (isString(rawValue) && rule.min !== undefined && rawValue.length < rule.min) {
      errors.push({ field: rule.field, message: `${rule.label} too short (min ${rule.min})`, severity: "error" });
    }
    if (isString(rawValue) && rule.max !== undefined && rawValue.length > rule.max) {
      errors.push({ field: rule.field, message: `${rule.label} too long (max ${rule.max})`, severity: "warning" });
    }
    if (isNumber(rawValue) && rule.min !== undefined && rawValue < rule.min) {
      errors.push({ field: rule.field, message: `${rule.label} below minimum (${rule.min})`, severity: "error" });
    }
    if (isNumber(rawValue) && rule.max !== undefined && rawValue > rule.max) {
      errors.push({ field: rule.field, message: `${rule.label} exceeds maximum (${rule.max})`, severity: "warning" });
    }

    // Regex
    if (isString(rawValue) && rule.pattern && !rule.pattern.test(rawValue)) {
      errors.push({ field: rule.field, message: `${rule.label} format is invalid`, severity: "error" });
    }
  }

  return {
    valid: errors.filter((e) => e.severity === "error").length === 0,
    errors,
  };
}

export function validateBatch(
  payloads: Record<string, unknown>[],
  format: IngestionFormat,
): { valid: boolean; results: ValidationResult[] } {
  const results = payloads.map((p) => validatePayload(p, format));
  return {
    valid: results.every((r) => r.valid),
    results,
  };
}