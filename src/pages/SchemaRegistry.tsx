import { useState, useRef } from "react";
import { AppShell } from "../components/layout/AppShell";
import { Card, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { useSchemaRegistry } from "../hooks/useSchemaRegistry";
import type { SchemaField, FieldType } from "../types/schema";
import {
  Database,
  Plus,
  Trash2,
  Pencil,
  Download,
  Upload,
  RotateCcw,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  GripVertical,
  X,
  ChevronRight,
  Eye,
} from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────

const TYPE_BADGE: Record<FieldType, { label: string; color: "info" | "success" | "warning" | "destructive" | "neutral" }> = {
  string: { label: "string", color: "info" },
  integer: { label: "integer", color: "success" },
  float: { label: "float", color: "success" },
  boolean: { label: "boolean", color: "warning" },
  enum: { label: "enum", color: "neutral" },
  json_schema: { label: "json", color: "destructive" },
  uuid: { label: "uuid", color: "info" },
  timestamp: { label: "timestamp", color: "info" },
};

function FieldTypeBadge({ type }: { type: FieldType }) {
  const meta = TYPE_BADGE[type];
  return <Badge variant={meta.color}>{meta.label}</Badge>;
}

// ── Add/Edit Field Modal ──────────────────────────────────────

const ALL_TYPES: FieldType[] = ["string", "integer", "float", "boolean", "enum", "json_schema", "uuid", "timestamp"];

interface FieldFormData {
  name: string;
  type: FieldType;
  description: string;
  required: boolean;
  min?: string;
  max?: string;
  alert_threshold?: string;
  unit?: string;
  enum_values: string;
  schema_ref?: string;
  example?: string;
}

const EMPTY_FORM: FieldFormData = {
  name: "",
  type: "string",
  description: "",
  required: false,
  min: "",
  max: "",
  alert_threshold: "",
  unit: "",
  enum_values: "",
  schema_ref: "",
  example: "",
};

function FieldFormModal({
  open,
  initial,
  onSave,
  onClose,
}: {
  open: boolean;
  initial: FieldFormData | null;
  onSave: (data: FieldFormData) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FieldFormData>(initial ?? EMPTY_FORM);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = () => {
    // Validation
    if (!form.name.trim()) {
      setError("Field name is required");
      return;
    }
    if (form.name.includes(" ")) {
      setError("Field name must not contain spaces (use snake_case)");
      return;
    }
    if (!form.description.trim()) {
      setError("Description is required");
      return;
    }
    if (form.type === "enum" && !form.enum_values.trim()) {
      setError("Enum type requires at least one value (comma separated)");
      return;
    }
    setError("");
    onSave(form);
    setForm(EMPTY_FORM);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-heading font-semibold text-foreground">
            {initial ? "Edit Field" : "Add Field"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Name & Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Field Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. latency_ms"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as FieldType })}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {ALL_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What does this field represent?"
              rows={2}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          {/* Required toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.required}
              onChange={(e) => setForm({ ...form, required: e.target.checked })}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary/30"
            />
            <span className="text-sm text-foreground">Required field</span>
          </label>

          {/* Numeric constraints - show for integer/float */}
          {(form.type === "integer" || form.type === "float") && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-background/50 rounded-lg border border-border">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Min</label>
                <input
                  type="number"
                  value={form.min}
                  onChange={(e) => setForm({ ...form, min: e.target.value })}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Max</label>
                <input
                  type="number"
                  value={form.max}
                  onChange={(e) => setForm({ ...form, max: e.target.value })}
                  placeholder="1000"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Alert Threshold</label>
                <input
                  type="number"
                  value={form.alert_threshold}
                  onChange={(e) => setForm({ ...form, alert_threshold: e.target.value })}
                  placeholder="e.g. 5000"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Unit</label>
                <input
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder="ms, tokens, USD"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          )}

          {/* Enum values */}
          {form.type === "enum" && (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Enum Values <span className="text-muted-foreground">(comma separated)</span>
              </label>
              <input
                value={form.enum_values}
                onChange={(e) => setForm({ ...form, enum_values: e.target.value })}
                placeholder="openai, anthropic, google"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}

          {/* JSON Schema ref */}
          {form.type === "json_schema" && (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Schema Reference</label>
              <input
                value={form.schema_ref}
                onChange={(e) => setForm({ ...form, schema_ref: e.target.value })}
                placeholder="my_output_schema_v1"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}

          {/* Example */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Example Value</label>
            <input
              value={form.example}
              onChange={(e) => setForm({ ...form, example: e.target.value })}
              placeholder="e.g. 1423"
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>
            {initial ? "Update Field" : "Add Field"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────

export default function SchemaRegistry() {
  const { fields, coverage, addField, updateField, removeField, resetToDefaults, exportSchema, importSchema } = useSchemaRegistry();
  const [activeTab, setActiveTab] = useState<"fields" | "export" | "about">("fields");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<SchemaField | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveField = (data: FieldFormData) => {
    if (editingField) {
      updateField(editingField.id, {
        name: data.name,
        type: data.type,
        description: data.description,
        required: data.required,
        min: data.min ? Number(data.min) : undefined,
        max: data.max ? Number(data.max) : undefined,
        alert_threshold: data.alert_threshold ? Number(data.alert_threshold) : undefined,
        unit: data.unit || undefined,
        enum_values: data.enum_values ? data.enum_values.split(",").map((v) => v.trim()).filter(Boolean) : undefined,
        schema_ref: data.schema_ref || undefined,
        example: data.example || undefined,
      });
    } else {
      addField({
        name: data.name,
        type: data.type,
        description: data.description,
        required: data.required,
        min: data.min ? Number(data.min) : undefined,
        max: data.max ? Number(data.max) : undefined,
        alert_threshold: data.alert_threshold ? Number(data.alert_threshold) : undefined,
        unit: data.unit || undefined,
        enum_values: data.enum_values ? data.enum_values.split(",").map((v) => v.trim()).filter(Boolean) : undefined,
        schema_ref: data.schema_ref || undefined,
        example: data.example || undefined,
      });
    }
    setModalOpen(false);
    setEditingField(null);
  };

  const handleEdit = (field: SchemaField) => {
    setEditingField(field);
    setModalOpen(true);
  };

  const handleExport = () => {
    const schema = exportSchema();
    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `observeai-schema-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target?.result as string);
        if (data.format?.startsWith("okf/")) {
          importSchema(data);
        } else {
          alert("Invalid schema format — expected 'okf/trace/v1'");
        }
      } catch {
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-imported
    e.target.value = "";
  };

  const initialFormData = editingField
    ? {
        name: editingField.name,
        type: editingField.type,
        description: editingField.description,
        required: editingField.required,
        min: editingField.min?.toString() ?? "",
        max: editingField.max?.toString() ?? "",
        alert_threshold: editingField.alert_threshold?.toString() ?? "",
        unit: editingField.unit ?? "",
        enum_values: editingField.enum_values?.join(", ") ?? "",
        schema_ref: editingField.schema_ref ?? "",
        example: editingField.example ?? "",
      }
    : null;

  return (
    <AppShell>
      {/* Hidden file input for importing */}
      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Schema Registry</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define, document, and share your trace schema — OKF-inspired self-describing format
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button variant="outline" onClick={handleImport}>
            <Upload className="w-4 h-4" />
            Import
          </Button>
          <Button onClick={() => { setEditingField(null); setModalOpen(true); }}>
            <Plus className="w-4 h-4" />
            Add Field
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <div className="flex items-center gap-3 p-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-heading text-2xl font-bold text-foreground">{coverage.total}</p>
              <p className="text-xs text-muted-foreground">Fields defined</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3 p-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              coverage.traceFieldsCovered >= 80 ? "bg-success/20" : coverage.traceFieldsCovered >= 50 ? "bg-warning/20" : "bg-destructive/20"
            }`}>
              <CheckCircle2 className={`w-5 h-5 ${
                coverage.traceFieldsCovered >= 80 ? "text-success" : coverage.traceFieldsCovered >= 50 ? "text-warning" : "text-destructive"
              }`} />
            </div>
            <div>
              <p className={`font-heading text-2xl font-bold ${
                coverage.traceFieldsCovered >= 80 ? "text-success" : coverage.traceFieldsCovered >= 50 ? "text-warning" : "text-destructive"
              }`}>
                {coverage.traceFieldsCovered}%
              </p>
              <p className="text-xs text-muted-foreground">Schema coverage</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3 p-3">
            <div className="w-10 h-10 rounded-lg bg-info/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="font-heading text-2xl font-bold text-foreground">{coverage.withAlert}</p>
              <p className="text-xs text-muted-foreground">Alert thresholds set</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3 p-3">
            <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="font-heading text-2xl font-bold text-foreground">{coverage.required}</p>
              <p className="text-xs text-muted-foreground">Required fields</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 p-1 bg-muted rounded-lg w-fit">
        {(["fields", "export", "about"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
              activeTab === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "fields" ? "Schema Fields" : tab === "export" ? "Export / Import" : "About OKF"}
          </button>
        ))}
      </div>

      {/* Tab: Fields */}
      {activeTab === "fields" && (
        <>
          {fields.length === 0 ? (
            <EmptyState
              icon={<Database className="w-12 h-12" />}
              title="No fields defined"
              description="Start by adding fields to your schema, or import a pre-built schema from JSON."
              action={
                <Button onClick={() => { setEditingField(null); setModalOpen(true); }}>
                  <Plus className="w-4 h-4" />
                  Add Your First Field
                </Button>
              }
            />
          ) : (
            <Card>
              <CardHeader
                title={`${fields.length} Fields`}
                subtitle="Self-describing schema with field-level metadata"
                action={
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={resetToDefaults}>
                      <RotateCcw className="w-4 h-4" />
                      Reset to defaults
                    </Button>
                  </div>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Field</th>
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Type</th>
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Required</th>
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Description</th>
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Constraints</th>
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Alert</th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field) => (
                      <tr key={field.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-medium text-foreground">{field.name}</span>
                            {field.example && (
                              <span className="text-[10px] text-muted-foreground" title={`Example: ${field.example}`}>
                                <Eye className="w-3 h-3 inline" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <FieldTypeBadge type={field.type} />
                        </td>
                        <td className="px-3 py-3">
                          {field.required ? (
                            <span className="text-xs text-destructive font-medium">Required</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Optional</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-xs text-foreground line-clamp-2">{field.description}</span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            {field.min !== undefined && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground font-mono">
                                min: {field.min}
                              </span>
                            )}
                            {field.max !== undefined && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground font-mono">
                                max: {field.max}
                              </span>
                            )}
                            {field.unit && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-background/50 rounded text-muted-foreground font-mono">
                                {field.unit}
                              </span>
                            )}
                            {field.enum_values?.length && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-info/10 rounded text-info font-mono">
                                {field.enum_values.length} values
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {field.alert_threshold !== undefined ? (
                            <span className="text-xs font-mono text-warning">
                              &gt; {field.alert_threshold}{field.unit ? ` ${field.unit}` : ""}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleEdit(field)}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
                              aria-label={`Edit ${field.name}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => removeField(field.id)}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer transition-colors"
                              aria-label={`Remove ${field.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Tab: Export / Import */}
      {activeTab === "export" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader
              title="Export Schema"
              subtitle="Download your schema as a self-describing JSON payload"
              icon={<Download className="w-5 h-5" />}
            />
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Exports in the <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">okf/trace/v1</code> format — 
                every field carries its type, description, constraints, and alert threshold. 
                The payload is self-describing: any consumer can interpret the data without side knowledge.
              </p>
              <div className="bg-background/50 border border-border rounded-lg p-3">
                <p className="text-xs font-mono text-muted-foreground mb-2">{'{'}</p>
                <p className="text-xs font-mono text-muted-foreground ml-3">"format": <span className="text-primary">"okf/trace/v1"</span>,</p>
                <p className="text-xs font-mono text-muted-foreground ml-3">"schema_version": "0.4.0",</p>
                <p className="text-xs font-mono text-muted-foreground ml-3">"name": "ObserveAI Trace Schema",</p>
                <p className="text-xs font-mono text-muted-foreground ml-3">"fields": [</p>
                <p className="text-xs font-mono text-muted-foreground ml-6">{'{'} "name": "latency_ms", "type": "integer", "min": 0, "alert_threshold": 5000 {'}'},</p>
                <p className="text-xs font-mono text-muted-foreground ml-3">...</p>
                <p className="text-xs font-mono text-muted-foreground">{'}'}</p>
              </div>
              <Button onClick={handleExport} className="w-full">
                <Download className="w-4 h-4" />
                Export Schema ({fields.length} fields)
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Import Schema"
              subtitle="Load a previously exported schema from JSON"
              icon={<Upload className="w-5 h-5" />}
            />
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload an <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">okf/trace/v1</code> JSON file to 
                replace your current schema. This is useful for sharing schemas across teams, environments, or tools.
              </p>
              <div className="flex items-center gap-3 p-3 bg-info/10 border border-info/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-info flex-shrink-0" />
                <p className="text-xs text-foreground">
                  Importing replaces all existing fields. Export your current schema first if you want to keep a backup.
                </p>
              </div>
              <Button variant="outline" onClick={handleImport} className="w-full">
                <Upload className="w-4 h-4" />
                Import from JSON
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Tab: About OKF */}
      {activeTab === "about" && (
        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader
              title="Open Knowledge Format (OKF)"
              subtitle="Inspired by Google Cloud's approach to self-describing data sharing"
            />
            <div className="space-y-4 text-sm text-foreground/80 leading-relaxed">
              <p>
                <strong>OKF</strong> is a concept introduced by Google Cloud for making datasets self-describing — 
                every field carries its schema, type, description, and constraints alongside the data itself. 
                No more guessing what <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">col_7</code> means.
              </p>
              <p>
                ObserveAI applies this philosophy to <strong>LLM trace data</strong>. 
                Instead of logging opaque trace payloads, each field is formally defined:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 border border-border rounded-lg bg-background/50">
                  <p className="text-xs font-semibold text-foreground mb-1">📋 Common Schema</p>
                  <p className="text-xs text-muted-foreground">Every trace field has a name, type, description, and constraints — consumers interpret it without tribal knowledge</p>
                </div>
                <div className="p-3 border border-border rounded-lg bg-background/50">
                  <p className="text-xs font-semibold text-foreground mb-1">⚠️ Alert Thresholds</p>
                  <p className="text-xs text-muted-foreground">Fields declare their own alert limits — latency_ms says "alert if &gt;5000ms" right in the schema</p>
                </div>
                <div className="p-3 border border-border rounded-lg bg-background/50">
                  <p className="text-xs font-semibold text-foreground mb-1">🔄 Interoperability</p>
                  <p className="text-xs text-muted-foreground">Export/import between teams, environments, and tools — schema travels with the data</p>
                </div>
                <div className="p-3 border border-border rounded-lg bg-background/50">
                  <p className="text-xs font-semibold text-foreground mb-1">📐 Column-Level Metadata</p>
                  <p className="text-xs text-muted-foreground">min/max bounds, enum values, JSON Schema references, units — all declared per field</p>
                </div>
              </div>

              <h3 className="font-heading font-semibold text-base text-foreground mt-6">How it maps to ObserveAI's 7 Failure Modes</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Failure Mode</th>
                      <th className="text-left py-2 pr-3 font-medium text-muted-foreground">OKF Field</th>
                      <th className="text-left py-2 font-medium text-muted-foreground">What the Schema Enables</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/50">
                      <td className="py-2 pr-3 text-foreground">Timeouts & Retries</td>
                      <td className="py-2 pr-3"><code className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono">latency_ms</code></td>
                      <td className="text-muted-foreground">Field declares <code className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono">alert_threshold: 5000</code> — alert rule auto-creates</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 pr-3 text-foreground">Prompt Injection</td>
                      <td className="py-2 pr-3"><code className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono">injection_flagged</code>, <code className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono">injection_severity</code></td>
                      <td className="text-muted-foreground">Enum type with 5 severity levels — can't set invalid severity</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 pr-3 text-foreground">Cost Control</td>
                      <td className="py-2 pr-3"><code className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono">cost_usd</code></td>
                      <td className="text-muted-foreground">Field declares min/max bounds and unit — BudgetProgressBar reads from schema</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 pr-3 text-foreground">Context Window</td>
                      <td className="py-2 pr-3"><code className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono">prompt_tokens</code></td>
                      <td className="text-muted-foreground">Max constraint and alert threshold power the ContextWindowBar</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 pr-3 text-foreground">Output Trust</td>
                      <td className="py-2 pr-3"><code className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono">response_json</code></td>
                      <td className="text-muted-foreground">JSON Schema ref allows SchemaValidationBadge to validate against declared structure</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-3 text-foreground">Test Determinism</td>
                      <td className="py-2 pr-3"><code className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono">status</code></td>
                      <td className="text-muted-foreground">Enum constrains outputs to known states — tests assert on shape, not prose</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/10 rounded-lg mt-2">
                <BookOpen className="w-5 h-5 text-primary flex-shrink-0" />
                <p className="text-xs text-foreground">
                  <strong>Learn more:</strong>{' '}
                  <a 
                    href="https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary underline hover:no-underline"
                  >
                    Google Cloud — How the Open Knowledge Format can improve data sharing
                  </a>
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Add/Edit Field Modal */}
      <FieldFormModal
        open={modalOpen}
        initial={initialFormData}
        onSave={handleSaveField}
        onClose={() => { setModalOpen(false); setEditingField(null); }}
      />
    </AppShell>
  );
}