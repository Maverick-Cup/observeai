import { useState, useCallback, useEffect } from "react";
import type { SchemaField, FieldType, SchemaExport } from "../types/schema";
import { DEFAULT_TRACE_FIELDS } from "../types/schema";

const STORAGE_KEY = "observeai_schema_fields";
const SCHEMA_VERSION = "0.4.0";

function generateId(): string {
  return `sf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Load fields from localStorage, falling back to DEFAULT_TRACE_FIELDS */
function loadFields(): SchemaField[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SchemaField[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // corrupt data — fall through to defaults
  }
  return DEFAULT_TRACE_FIELDS.map((f) => ({
    ...f,
    id: generateId(),
    created_at: Date.now(),
    updated_at: Date.now(),
  }));
}

export function useSchemaRegistry() {
  const [fields, setFields] = useState<SchemaField[]>(loadFields);
  const [isInitialized, setIsInitialized] = useState(false);

  // Persist to localStorage on change
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fields));
    } else {
      setIsInitialized(true);
    }
  }, [fields, isInitialized]);

  const addField = useCallback((field: Omit<SchemaField, "id" | "created_at" | "updated_at">) => {
    const now = Date.now();
    const newField: SchemaField = {
      ...field,
      id: generateId(),
      created_at: now,
      updated_at: now,
    };
    setFields((prev) => [...prev, newField]);
  }, []);

  const updateField = useCallback((id: string, updates: Partial<Omit<SchemaField, "id" | "created_at">>) => {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates, updated_at: Date.now() } : f))
    );
  }, []);

  const removeField = useCallback((id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const resetToDefaults = useCallback(() => {
    const defaults = DEFAULT_TRACE_FIELDS.map((f) => ({
      ...f,
      id: generateId(),
      created_at: Date.now(),
      updated_at: Date.now(),
    }));
    setFields(defaults);
  }, []);

  /** Export all fields as self-describing SchemaExport payload */
  const exportSchema = useCallback((): SchemaExport => {
    return {
      format: "okf/trace/v1",
      schema_version: SCHEMA_VERSION,
      name: "ObserveAI Trace Schema",
      description: "Self-describing schema for LLM trace data, OKF-inspired format",
      exported_at: Date.now(),
      fields: fields.map(({ id, created_at, updated_at, ...rest }) => rest),
    };
  }, [fields]);

  /** Import fields from a SchemaExport payload */
  const importSchema = useCallback((data: SchemaExport) => {
    const now = Date.now();
    const imported: SchemaField[] = data.fields.map((f) => ({
      ...f,
      id: generateId(),
      created_at: now,
      updated_at: now,
    }));
    setFields(imported);
  }, []);

  const getFieldByName = useCallback(
    (name: string): SchemaField | undefined => fields.find((f) => f.name === name),
    [fields]
  );

  /** Coverage stats */
  const coverage = {
    total: fields.length,
    required: fields.filter((f) => f.required).length,
    withAlert: fields.filter((f) => f.alert_threshold !== undefined).length,
    withDescription: fields.filter((f) => f.description.length > 0).length,
    /** Coverage percentage based on all trace-relevant fields vs defaults */
    traceFieldsCovered: Math.round((fields.length / DEFAULT_TRACE_FIELDS.length) * 100),
  };

  return {
    fields,
    coverage,
    addField,
    updateField,
    removeField,
    resetToDefaults,
    exportSchema,
    importSchema,
    getFieldByName,
    SCHEMA_VERSION,
  };
}