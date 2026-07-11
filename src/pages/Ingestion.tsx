import { AppShell } from "../components/layout/AppShell";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Database,
  Network,
  FileText,
  RefreshCw,
  Trash2,
  Key,
  Plus,
  Copy,
  Code2,
  Send,
  Info,
  Terminal,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { ingestStore } from "../engine/ingestion/store";
import {
  ingestJSON,
  ingestSyslog,
  ingestOTel,
  ingestCSV,
} from "../engine/ingestion/pipeline";
import { convexMutation, convexQuery, isConvexConfigured } from "../lib/convex";
import {
  listLocalKeys,
  generateLocalKey,
  revokeLocalKey,
} from "../engine/ingestion/local-keys";
import type { IngestEvent, IngestBatch, IngestPipelineStats } from "../types/ingestion";
import type { LocalApiKey } from "../engine/ingestion/local-keys";

// ─── Demo sources ──────────────────────────────────────────────────────────────

const DEMO_SOURCES = [
  { label: "REST / JSON", source: "rest_api" as const, format: "json" as const, color: "text-blue-500" },
  { label: "Syslog", source: "syslog_daemon" as const, format: "syslog" as const, color: "text-amber-500" },
  { label: "OpenTelemetry", source: "otel_collector" as const, format: "otel" as const, color: "text-green-500" },
  { label: "CSV Import", source: "csv_upload" as const, format: "csv" as const, color: "text-purple-500" },
];

const DEMO_PAYLOADS: Record<string, unknown> = {
  json: {
    traceId: `trace-${Date.now()}`,
    model: "gpt-4",
    input: "What's the capital of France?",
    output: "Paris is the capital of France.",
    durationMs: 1234,
    inputTokens: 42,
    outputTokens: 156,
    tags: ["demo", "geography"],
  },
  syslog: "<134>1 2024-01-15T10:30:00Z myhost myapp 1234 ID47 - Request processed: 200 OK",
  otel: [
    {
      traceId: `otel-${Date.now()}`,
      spanId: `span-${Date.now()}`,
      name: "llm.call",
      startTimeUnixNano: Date.now() * 1_000_000,
      endTimeUnixNano: (Date.now() + 500) * 1_000_000,
      attributes: [
        { key: "llm.model", value: { stringValue: "gpt-4" } },
        { key: "llm.tokens", value: { intValue: "150" } },
      ],
    },
  ],
  csv: "query,response,model,latency,flagged\nWhat is AI?,Artificial Intelligence is...,gpt-4,1200,false\n",
};

const STATUS_ICONS: Record<string, typeof CheckCircle> = {
  completed: CheckCircle,
  failed: XCircle,
  rejected: AlertTriangle,
  received: Clock,
  validating: RefreshCw,
  transforming: RefreshCw,
  processing: Activity,
};

const STATUS_COLORS: Record<string, string> = {
  completed: "text-success",
  failed: "text-destructive",
  rejected: "text-warning",
  received: "text-muted-foreground",
  validating: "text-primary",
  transforming: "text-primary",
  processing: "text-primary",
};

// ─── API Key types ─────────────────────────────────────────────────────────────

interface ApiKeyEntry {
  _id: string;
  label: string;
  createdAt: number;
  lastUsedAt?: number;
  isActive: boolean;
}

// ─── Webhook preset payloads ───────────────────────────────────────────────────

const WEBHOOK_PRESETS = [
  {
    label: "Chat Completion",
    value: JSON.stringify({
      traceId: `wh-${Date.now()}`,
      model: "gpt-4",
      input: "Explain quantum computing simply.",
      output: "Quantum computing uses qubits instead of bits...",
      durationMs: 2340,
      inputTokens: 18,
      outputTokens: 142,
      tags: ["webhook", "science"],
    }, null, 2),
  },
  {
    label: "Embedding Request",
    value: JSON.stringify({
      traceId: `wh-${Date.now()}`,
      model: "text-embedding-3-small",
      input: "The quick brown fox jumps over the lazy dog.",
      output: "",
      durationMs: 890,
      inputTokens: 10,
      outputTokens: 0,
      tags: ["webhook", "embedding"],
    }, null, 2),
  },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export default function Ingestion() {
  const [events, setEvents] = useState<IngestEvent[]>([]);
  const [batches, setBatches] = useState<IngestBatch[]>([]);
  const [stats, setStats] = useState<IngestPipelineStats | null>(null);
  const [isIngesting, setIsIngesting] = useState<string | null>(null);
  // FIX 3: Default to "integrations" tab so users see how to connect first
  const [activeTab, setActiveTab] = useState<"integrations" | "pipeline" | "events" | "batches">("integrations");

  // Integrations state
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>([]);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [webhookPayload, setWebhookPayload] = useState(WEBHOOK_PRESETS[0].value);
  const [webhookResult, setWebhookResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isSendingWebhook, setIsSendingWebhook] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // FIX 1 & 4: Detect demo mode
  const [isDemoMode] = useState(!isConvexConfigured());
  // Local fallback keys (used when Convex isn't available)
  const [localKeys, setLocalKeys] = useState<LocalApiKey[]>([]);

  const keyRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setEvents(await ingestStore.listRecentEvents(50));
    setBatches(await ingestStore.listBatches(20));
    setStats(await ingestStore.getStats());
    if (!isDemoMode) {
      loadApiKeys();
    } else {
      // FIX 1: Load local keys instead
      setLocalKeys(listLocalKeys());
    }
  };

  const loadApiKeys = async () => {
    setLoadingKeys(true);
    try {
      const keys = await convexQuery<Record<string, unknown>, ApiKeyEntry[]>("apiKeys:list", {});
      setApiKeys(keys ?? []);
    } catch { /* silently fail — auth not ready */ }
    setLoadingKeys(false);
  };

  useEffect(() => {
    refresh();

    // FIX 2: Expose pipeline functions on window for Browser Console testing
    if (typeof window !== "undefined") {
      (window as any).__observeai = {
        ingestJSON,
        ingestSyslog,
        ingestOTel,
        ingestCSV,
        help: "Call any of these from the console: __observeai.ingestJSON({model:'gpt-4', input:'Hi', output:'Hello'})",
      };
    }
  }, []);

  // ── Demo ingest ────────────────────────────────────────────────────────────

  const handleDemoIngest = async (source: string, format: string) => {
    setIsIngesting(format);
    try {
      const payload = DEMO_PAYLOADS[format];
      switch (format) {
        case "json":
          await ingestJSON(payload as Record<string, unknown>, source as any);
          break;
        case "syslog":
          await ingestSyslog(payload as string, source as any);
          break;
        case "otel":
          await ingestOTel(payload as unknown[], source as any);
          break;
        case "csv":
          await ingestCSV(payload as string, source as any);
          break;
      }
      await refresh();
    } finally {
      setIsIngesting(null);
    }
  };

  const handleClear = async () => {
    location.reload();
  };

  // ── API keys (with local fallback) ────────────────────────────────────────

  const handleGenerateKey = async () => {
    if (!newKeyLabel.trim()) return;
    setIsGenerating(true);
    setGeneratedKey(null);
    try {
      if (isDemoMode) {
        // FIX 1: Local fallback — store in localStorage
        const newKey = generateLocalKey(newKeyLabel.trim());
        setGeneratedKey(newKey.key);
        setNewKeyLabel("");
        setShowGenerateForm(false);
        setLocalKeys(listLocalKeys());
      } else {
        const result = await convexMutation<{ label: string }, { key: string }>(
          "apiKeys:generate",
          { label: newKeyLabel.trim() },
        );
        if (result?.key) {
          setGeneratedKey(result.key);
          setNewKeyLabel("");
          setShowGenerateForm(false);
          await loadApiKeys();
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate key";
      setGeneratedKey(`ERROR: ${msg}`);
    }
    setIsGenerating(false);
  };

  const handleRevoke = async (keyId: string) => {
    setRevokingId(keyId);
    try {
      if (isDemoMode) {
        revokeLocalKey(keyId);
        setLocalKeys(listLocalKeys());
      } else {
        await convexMutation<{ keyId: string }, { status: string }>("apiKeys:revoke", { keyId });
        await loadApiKeys();
      }
    } catch { /* handled by button re-enable */ }
    setRevokingId(null);
  };

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  // ── Webhook testing ────────────────────────────────────────────────────────

  const handleSendWebhook = async () => {
    setIsSendingWebhook(true);
    setWebhookResult(null);
    try {
      const parsed = JSON.parse(webhookPayload);
      await ingestJSON(parsed, "webhook_test");
      setWebhookResult({ ok: true, msg: "Event ingested successfully! Check the Events tab." });
      await refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid payload or parse error";
      setWebhookResult({ ok: false, msg });
    }
    setIsSendingWebhook(false);
  };

  // ── Determine which keys to display ───────────────────────────────────────

  const displayedKeys: (ApiKeyEntry | LocalApiKey)[] = isDemoMode
    ? localKeys
    : apiKeys;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Ingestion Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Send data to ObserveAI — no files, no dumps, no spreadsheets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClear} className="text-destructive">
            <Trash2 className="w-4 h-4" /> Clear
          </Button>
        </div>
      </div>

      {/* FIX 4: Demo mode banner */}
      {isDemoMode && (
        <div className="mb-6 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              🔧 Demo Mode — No Backend Deployed
            </p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">
              API keys are stored locally and the HTTP endpoints shown in snippets are placeholder examples.
              Use the <strong>"Ship Some Data"</strong> buttons below to test the pipeline, or open your
              browser console <kbd className="px-1 py-0.5 rounded bg-amber-200/50 dark:bg-amber-800/50 font-mono">F12</kbd> and type
              <code className="px-1 py-0.5 rounded bg-amber-200/50 dark:bg-amber-800/50 font-mono ml-1">
                __observeai.ingestJSON({"{"}model:'gpt-4', input:'Hi', output:'Hello'{"}"})
              </code>
            </p>
          </div>
        </div>
      )}

      {/* Tab-aware KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {activeTab === "integrations" && (
          <>
            <Card additionalClass="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Active Keys</span>
                <Key className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold text-foreground">
                {displayedKeys.filter(k => k.isActive).length}
              </p>
            </Card>
            <Card additionalClass="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Revoked Keys</span>
                <Key className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold text-foreground">
                {displayedKeys.filter(k => !k.isActive).length}
              </p>
            </Card>
            <Card additionalClass="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Snippets Ready</span>
                <Code2 className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold text-foreground">4</p>
            </Card>
            <Card additionalClass="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Webhook Tests</span>
                <Send className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold text-foreground">
                {events.filter(e => e.source === "webhook_test").length}
              </p>
            </Card>
            <Card additionalClass="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Formats</span>
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold text-foreground">4</p>
            </Card>
          </>
        )}
        {activeTab === "pipeline" && stats && (
          <>
            <Card additionalClass="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Received</span>
                <Database className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.totalReceived}</p>
            </Card>
            <Card additionalClass="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Completed</span>
                <CheckCircle className="w-4 h-4 text-success" />
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.totalCompleted}</p>
            </Card>
            <Card additionalClass="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Failed</span>
                <XCircle className="w-4 h-4 text-destructive" />
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.totalFailed}</p>
            </Card>
            <Card additionalClass="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Avg Latency</span>
                <Clock className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.avgLatencyMs}ms</p>
            </Card>
            <Card additionalClass="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Throughput</span>
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.throughputPerMinute}/min</p>
            </Card>
          </>
        )}
        {activeTab === "events" && (
          <>
            <Card additionalClass="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Total Events</span>
                <Database className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold text-foreground">{events.length}</p>
            </Card>
            <Card additionalClass="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Sources</span>
                <Network className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold text-foreground">
                {new Set(events.map(e => e.source)).size}
              </p>
            </Card>
            <Card additionalClass="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Successful</span>
                <CheckCircle className="w-4 h-4 text-success" />
              </div>
              <p className="text-2xl font-bold text-foreground">
                {events.filter(e => e.status === "completed").length}
              </p>
            </Card>
            <Card additionalClass="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Failed / Rejected</span>
                <XCircle className="w-4 h-4 text-destructive" />
              </div>
              <p className="text-2xl font-bold text-foreground">
                {events.filter(e => e.status === "failed" || e.status === "rejected").length}
              </p>
            </Card>
            <Card additionalClass="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Today</span>
                <Clock className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold text-foreground">
                {events.filter(e => new Date(e.receivedAt).toDateString() === new Date().toDateString()).length}
              </p>
            </Card>
          </>
        )}
        {activeTab === "batches" && (
          <>
            <Card additionalClass="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Total Batches</span>
                <FileText className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold text-foreground">{batches.length}</p>
            </Card>
            <Card additionalClass="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Completed</span>
                <CheckCircle className="w-4 h-4 text-success" />
              </div>
              <p className="text-2xl font-bold text-foreground">
                {batches.filter(b => b.status === "completed").length}
              </p>
            </Card>
            <Card additionalClass="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Failed</span>
                <XCircle className="w-4 h-4 text-destructive" />
              </div>
              <p className="text-2xl font-bold text-foreground">
                {batches.filter(b => b.status === "failed").length}
              </p>
            </Card>
            <Card additionalClass="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Avg Batch Size</span>
                <Database className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold text-foreground">
                {batches.length > 0
                  ? Math.round(batches.reduce((s, b) => s + b.eventCount, 0) / batches.length)
                  : "—"}
              </p>
            </Card>
            <Card additionalClass="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Success Rate</span>
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold text-foreground">
                {batches.length > 0
                  ? Math.round(
                      (batches.reduce((s, b) => s + b.successCount, 0) /
                        Math.max(1, batches.reduce((s, b) => s + b.eventCount, 0))) *
                        100
                    ) + "%"
                  : "—"}
              </p>
            </Card>
          </>
        )}
      </div>

      {/* Demo Ingest Buttons */}
      <Card additionalClass="p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Ship Some Data</h2>
            <p className="text-xs text-muted-foreground">Click a source to push a demo event through the pipeline</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {DEMO_SOURCES.map((s) => (
            <Button
              key={s.format}
              variant="outline"
              size="sm"
              onClick={() => handleDemoIngest(s.source, s.format)}
              disabled={isIngesting !== null}
            >
              {isIngesting === s.format ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Ingesting...</>
              ) : (
                <><Zap className="w-4 h-4" /> {s.label}</>
              )}
            </Button>
          ))}
        </div>
      </Card>

      {/* ── Tabs (FIX 3: Integrations first) ──────────────────────────────── */}
      <div className="flex items-center gap-1 mb-6 border-b border-border overflow-x-auto">
        {(["integrations", "pipeline", "events", "batches"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === tab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "integrations" ? "🛠️ Integrations" : tab === "events" ? `📡 Events (${events.length})` : tab === "batches" ? `📦 Batches (${batches.length})` : "📊 Pipeline Health"}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          INTEGRATIONS TAB (was 4th, now 1st)
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "integrations" && (
        <div className="space-y-8">
          {/* ── Section: API Keys ──────────────────────────────────────────── */}
          <Card additionalClass="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Key className="w-4 h-4 text-primary" /> API Keys
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Keys used to authenticate incoming data from your services.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => { setShowGenerateForm(true); setGeneratedKey(null); }}
                disabled={showGenerateForm}
              >
                <Plus className="w-4 h-4" /> Generate Key
              </Button>
            </div>

            {/* Generate form */}
            {showGenerateForm && (
              <div className="mb-4 p-3 rounded-lg border border-border bg-muted/20 space-y-3">
                <label className="text-xs font-medium text-foreground">
                  Key Label <span className="text-muted-foreground">(e.g. "Production LLM Server")</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newKeyLabel}
                    onChange={(e) => setNewKeyLabel(e.target.value)}
                    placeholder="My integration"
                    className="flex-1 px-3 py-1.5 text-sm rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleGenerateKey()}
                  />
                  <Button size="sm" onClick={handleGenerateKey} disabled={isGenerating || !newKeyLabel.trim()}>
                    {isGenerating ? "Generating..." : "Create"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowGenerateForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Generated key display */}
            {generatedKey && (
              <div className="mb-4 p-3 rounded-lg border border-border bg-muted/20">
                <p className="text-xs font-medium text-foreground mb-1 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-success" />
                  Key generated!{" "}
                  <span className="text-destructive font-normal">Copy it now — you won't see it again.</span>
                </p>
                <div className="flex items-center gap-2">
                  <input
                    ref={keyRef}
                    type="text"
                    readOnly
                    value={generatedKey.startsWith("ERROR:") ? "" : generatedKey}
                    className={`flex-1 px-3 py-1.5 text-xs font-mono rounded-md border ${
                      generatedKey.startsWith("ERROR:")
                        ? "border-destructive bg-destructive/10 text-destructive"
                        : "border-border bg-background text-foreground"
                    }`}
                    placeholder={generatedKey.startsWith("ERROR:") ? generatedKey : ""}
                  />
                  {!generatedKey.startsWith("ERROR:") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(generatedKey, 999)}
                    >
                      {copiedIdx === 999 ? "Copied!" : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Key list */}
            {loadingKeys ? (
              <div className="text-xs text-muted-foreground py-4 text-center">Loading keys...</div>
            ) : displayedKeys.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center">
                No API keys yet. Generate one to start pushing data from your services.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-2 py-2 text-xs font-medium text-muted-foreground">Label</th>
                      <th className="text-left px-2 py-2 text-xs font-medium text-muted-foreground">Created</th>
                      <th className="text-left px-2 py-2 text-xs font-medium text-muted-foreground">Last Used</th>
                      <th className="text-left px-2 py-2 text-xs font-medium text-muted-foreground">Status</th>
                      <th className="text-right px-2 py-2 text-xs font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedKeys.map((k) => (
                      <tr key={k.id ?? k._id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="px-2 py-2.5 text-foreground font-medium">{k.label}</td>
                        <td className="px-2 py-2.5 text-xs text-muted-foreground">
                          {new Date(k.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-2 py-2.5 text-xs text-muted-foreground">
                          {(k as any).lastUsedAt ? new Date((k as any).lastUsedAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-2 py-2.5">
                          <Badge variant={k.isActive ? "success" : "neutral"}>
                            {k.isActive ? "Active" : "Revoked"}
                          </Badge>
                        </td>
                        <td className="px-2 py-2.5 text-right">
                          {k.isActive && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive text-xs"
                              onClick={() => handleRevoke(k.id ?? k._id)}
                              disabled={revokingId === (k.id ?? k._id)}
                            >
                              {revokingId === (k.id ?? k._id) ? "Revoking..." : "Revoke"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* ── Section: Webhook Testing ───────────────────────────────────── */}
          <Card additionalClass="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Send className="w-4 h-4 text-primary" /> Webhook Testing
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Send a test event to verify your integration works.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Preset selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Presets:</span>
                {WEBHOOK_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    size="sm"
                    variant={webhookPayload === preset.value ? "default" : "outline"}
                    onClick={() => setWebhookPayload(preset.value)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>

              {/* Payload editor */}
              <textarea
                value={webhookPayload}
                onChange={(e) => setWebhookPayload(e.target.value)}
                className="w-full h-40 px-3 py-2 text-xs font-mono rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
                spellCheck={false}
              />

              {/* Send & Result */}
              <div className="flex items-center gap-3">
                <Button onClick={handleSendWebhook} disabled={isSendingWebhook}>
                  {isSendingWebhook ? "Sending..." : <><Send className="w-4 h-4" /> Send Test Event</>}
                </Button>
                {webhookResult && (
                  <div className={`flex items-center gap-1.5 text-xs ${
                    webhookResult.ok ? "text-success" : "text-destructive"
                  }`}>
                    {webhookResult.ok ? (
                      <CheckCircle className="w-3.5 h-3.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    {webhookResult.msg}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* ── Section: Quick Start Snippets (FIX 2: added console alternative) ── */}
          <Card additionalClass="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-primary" /> Quick Start Snippets
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Copy-paste these into your services to start shipping data.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Browser Console (new) — always works in the demo */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
                    Browser Console — works right now
                  </span>
                  <button
                    onClick={() => copyToClipboard(
                      `__observeai.ingestJSON({model:"gpt-4", input:"Hello", output:"World", durationMs:500})`,
                      10
                    )}
                    className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedIdx === 10 ? "Copied!" : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
                <pre className="bg-muted/30 border border-border rounded-lg p-3 text-xs font-mono text-foreground overflow-x-auto">
{`// Open browser console (F12) and paste:
__observeai.ingestJSON({
  model: "gpt-4",
  input: "Hello",
  output: "World",
  durationMs: 500
});

// All available functions:
//   __observeai.ingestJSON(data, source?)
//   __observeai.ingestSyslog(rawText, source?)
//   __observeai.ingestOTel(spans, source?)
//   __observeai.ingestCSV(csvText, source?)`}
                </pre>
              </div>

              {/* curl JSON — with demo disclaimer */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-foreground">REST / JSON — curl</span>
                  <button
                    onClick={() => copyToClipboard(`curl -X POST ${window.location.origin}/ingest \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-observeai-xxx" \\
  -d '{"model":"gpt-4","input":"Hello","output":"World"}'`, 0)}
                    className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedIdx === 0 ? "Copied!" : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
                <pre className="bg-muted/30 border border-border rounded-lg p-3 text-xs font-mono text-foreground overflow-x-auto">
{`curl -X POST ${window.location.origin}/ingest \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-observeai-xxx" \\
  -d '{"model":"gpt-4","input":"Hello","output":"World"}'`}
                </pre>
                {isDemoMode && (
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    ℹ️ In the demo these endpoints are stubs. Use the <strong>Browser Console</strong> snippet above
                    or the <strong>Ship Some Data</strong> buttons to test locally.
                  </p>
                )}
              </div>

              {/* curl OTel */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-foreground">OpenTelemetry — curl</span>
                  <button
                    onClick={() => copyToClipboard(`curl -X POST ${window.location.origin}/ingest/otel \\
  -H "Content-Type: application/json" \\
  -d '{"resourceSpans":[{"scopeSpans":[{"spans":[{"traceId":"abc","spanId":"def","name":"llm.call"}]}]}]}'`, 1)}
                    className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedIdx === 1 ? "Copied!" : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
                <pre className="bg-muted/30 border border-border rounded-lg p-3 text-xs font-mono text-foreground overflow-x-auto">
{`curl -X POST ${window.location.origin}/ingest/otel \
  -H "Content-Type: application/json" \
  -d '{"resourceSpans":[{"scopeSpans":[{"spans":[{"traceId":"abc","spanId":"def","name":"llm.call"}]}]}]}'`}
                </pre>
                {isDemoMode && (
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    ℹ️ Alternatively, paste into console: <code className="font-mono">__observeai.ingestOTel([{"{"}traceId:"abc"{"}"}])</code>
                  </p>
                )}
              </div>

              {/* Python snippet */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-foreground">Python — requests</span>
                  <button
                    onClick={() => copyToClipboard(`import requests

url = "${window.location.origin}/ingest"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer sk-observeai-xxx",
}
payload = {
    "model": "gpt-4",
    "input": "Explain quantum computing",
    "output": "Quantum computing uses qubits...",
    "durationMs": 1234,
    "inputTokens": 10,
    "outputTokens": 200,
}

resp = requests.post(url, json=payload, headers=headers)
print(resp.status_code)`, 2)}
                    className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedIdx === 2 ? "Copied!" : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
                <pre className="bg-muted/30 border border-border rounded-lg p-3 text-xs font-mono text-foreground overflow-x-auto">
{`import requests

url = "${window.location.origin}/ingest"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer sk-observeai-xxx",
}
payload = {
    "model": "gpt-4",
    "input": "Explain quantum computing",
    "output": "Quantum computing uses qubits...",
    "durationMs": 1234,
    "inputTokens": 10,
    "outputTokens": 200,
}

resp = requests.post(url, json=payload, headers=headers)
print(resp.status_code)`}
                </pre>
              </div>
            </div>
          </Card>

          {/* ── Info box ────────────────────────────────────────────────────── */}
          <div className="rounded-lg bg-muted/20 border border-border p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">📡 How ingestion works</p>
            <p>
              Your services send events to the ObserveAI ingestion endpoint. Each event is validated,
              transformed into the internal schema, and stored. You can monitor throughput, error rates,
              and latency on the Pipeline tab. Supports JSON, Syslog, OpenTelemetry, and CSV formats.
            </p>
            {isDemoMode && (
              <p className="mt-2 text-amber-600 dark:text-amber-400">
                💡 <strong>Try it now:</strong> Open the browser console (<kbd className="px-1 py-0.5 rounded bg-muted font-mono">F12</kbd>) and type{' '}
                <code className="px-1 py-0.5 rounded bg-muted font-mono">__observeai.ingestJSON({"{"}model:'gpt-4', input:'Hi', output:'Hello'{"}"})</code>
              </p>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PIPELINE TAB
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "pipeline" && stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Error breakdown */}
          <Card additionalClass="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Top Pipeline Errors</h3>
            {stats.topErrors.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center">
                No errors yet. Pipeline is clean. (Don't jinx it.)
              </div>
            ) : (
              <div className="space-y-2">
                {stats.topErrors.map((err, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-foreground truncate mr-2">{err.message}</span>
                    <Badge variant="error">{err.count}x</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Integration sources */}
          <Card additionalClass="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Active Sources (24h)</h3>
            {stats.integrations.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center">
                No sources have sent data today. Go make some noise.
              </div>
            ) : (
              <div className="space-y-3">
                {stats.integrations.map((src, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Network className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">{src.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">{src.events24h} events</span>
                      <Badge variant={src.errorRate > 10 ? "error" : src.errorRate > 0 ? "warning" : "success"}>
                        {src.errorRate}% err
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* P95 Latency */}
          <Card additionalClass="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Pipeline Performance</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Average Latency</span>
                <span className="font-mono text-foreground">{stats.avgLatencyMs}ms</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">P95 Latency</span>
                <span className="font-mono text-foreground">{stats.p95LatencyMs}ms</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Success Rate</span>
                <span className="font-mono text-foreground">
                  {stats.totalReceived > 0
                    ? Math.round((stats.totalCompleted / stats.totalReceived) * 100)
                    : 100}%
                </span>
              </div>
            </div>
          </Card>

          {/* Pipeline stages */}
          <Card additionalClass="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Pipeline Stages</h3>
            <div className="space-y-2">
              {[
                { stage: "Receive", status: "operational", latency: "<1ms" },
                { stage: "Validate", status: stats.totalRejected > 0 ? "degraded" : "operational", latency: "~2ms" },
                { stage: "Transform", status: stats.totalFailed > 0 ? "degraded" : "operational", latency: "~15ms" },
                { stage: "Store", status: "operational", latency: "<1ms" },
              ].map((s) => (
                <div key={s.stage} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      s.status === "operational" ? "bg-success" : "bg-warning"
                    }`} />
                    <span className="text-foreground">{s.stage}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{s.latency}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          EVENTS TAB
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "events" && (
        <Card additionalClass="p-0 overflow-hidden">
          {events.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Activity className="w-8 h-8" />}
                title="No events yet"
                description="Ship some demo data above or configure a legacy integration to push data in."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">ID</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Source</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Format</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Trace</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Latency</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Received</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((evt) => {
                    const StatusIcon = STATUS_ICONS[evt.status] ?? Activity;
                    return (
                      <tr key={evt.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{evt.id.slice(0, 16)}</td>
                        <td className="px-4 py-3 text-foreground">{evt.source}</td>
                        <td className="px-4 py-3">
                          <Badge variant="neutral">{evt.format}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <StatusIcon className={`w-3.5 h-3.5 ${STATUS_COLORS[evt.status] ?? ""}`} />
                            <span className="text-foreground">{evt.status}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-muted-foreground">
                            {evt.traceId ? evt.traceId.slice(0, 20) : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-foreground">
                          {evt.processingLatencyMs ? `${evt.processingLatencyMs}ms` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                          {new Date(evt.receivedAt).toLocaleTimeString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          BATCHES TAB
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "batches" && (
        <div className="grid grid-cols-1 gap-4">
          {batches.length === 0 ? (
            <Card additionalClass="p-8">
              <EmptyState
                icon={<FileText className="w-8 h-8" />}
                title="No batches yet"
                description="Batches appear when you ingest multiple events at once."
              />
            </Card>
          ) : (
            batches.map((batch) => (
              <Card key={batch.id} additionalClass="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-mono text-foreground">{batch.id.slice(0, 20)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral">{batch.format}</Badge>
                    <Badge variant={batch.status === "completed" ? "success" : "error"}>
                      {batch.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{batch.eventCount} events</span>
                  <span className="text-success">{batch.successCount} ok</span>
                  {batch.failureCount > 0 && (
                    <span className="text-destructive">{batch.failureCount} failed</span>
                  )}
                  {batch.totalLatencyMs && (
                    <span className="font-mono">{batch.totalLatencyMs}ms total</span>
                  )}
                  <span className="text-muted-foreground">{batch.source}</span>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </AppShell>
  );
}