import { useState, useEffect, useCallback } from "react";
import { AppShell } from "../components/layout/AppShell";
import { Card, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { DataTable } from "../components/ui/DataTable";
import {
  Puzzle,
  Rocket,
  Database,
  FlaskConical,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Key,
  Search,
  FileDown,
  Play,
  AlertCircle,
  Sparkles,
  TrendingUp,
  Clock,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  connectProvider,
  disconnectProvider,
  getClient,
  type IntegrationConnectionResult,
} from "../engine/integrations";
import { FireworksClient } from "../engine/integrations/fireworks";
import type {
  FireworksAPIModel,
  FireworksAPIDataset,
  FireworksAPIFinetuneJob,
} from "../engine/integrations/fireworks";
import {
  FIREWORKS_MODELS,
  FIREWORKS_DATASETS,
  FIREWORKS_FINETUNE_JOBS,
  type FireworksModel,
  type FireworksDataset,
  type FireworksFinetuneJob,
} from "../types/integrations";

// ── Helpers ───────────────────────────────────────────────────────

/** Map Fireworks API model to our internal type */
function apiModelToInternal(m: FireworksAPIModel): FireworksModel {
  return {
    id: m.id,
    name: m.id.split("/").pop()?.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? m.id,
    provider: m.owned_by,
    type: (m.type as FireworksModel["type"]) || "chat",
    contextWindow: m.context_length ?? 16384,
    pricing: {
      inputPerMillion: m.pricing?.input ?? 0,
      outputPerMillion: m.pricing?.output ?? 0,
    },
  };
}

/** Map Fireworks API dataset to our internal type */
function apiDatasetToInternal(d: FireworksAPIDataset): FireworksDataset {
  return {
    id: d.id,
    name: d.name,
    description: d.description ?? "",
    rowCount: d.row_count,
    createdAt: new Date(d.created_at).getTime(),
    updatedAt: new Date(d.updated_at).getTime(),
    tags: d.tags ?? [],
    format: (d.format === "csv" ? "csv" : "jsonl") as FireworksDataset["format"],
  };
}

/** Map Fireworks API finetune job to internal */
function apiJobToInternal(j: FireworksAPIFinetuneJob): FireworksFinetuneJob {
  return {
    id: j.id,
    model: j.model,
    datasetId: j.dataset_id,
    status: j.status,
    progress: j.progress,
    baseModel: j.base_model,
    createdAt: new Date(j.created_at).getTime(),
    completedAt: j.completed_at ? new Date(j.completed_at).getTime() : null,
    metrics: j.metrics
      ? {
          trainLoss: j.metrics.train_loss,
          evalLoss: j.metrics.eval_loss,
          accuracy: j.metrics.accuracy,
        }
      : undefined,
  };
}

// ── Main component ────────────────────────────────────────────────
export default function Integrations() {
  const [activeTab, setActiveTab] = useState<"providers" | "datasets" | "finetune">("providers");
  const [fireworksKey, setFireworksKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Fetched data state
  const [models, setModels] = useState<FireworksModel[]>(FIREWORKS_MODELS);
  const [datasets, setDatasets] = useState<FireworksDataset[]>(FIREWORKS_DATASETS);
  const [finetuneJobs, setFinetuneJobs] = useState<FireworksFinetuneJob[]>(FIREWORKS_FINETUNE_JOBS);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [datasetSearch, setDatasetSearch] = useState("");

  // ── Connect ──────────────────────────────────────────────────
  const handleConnect = async () => {
    const key = fireworksKey.trim();
    if (!key) return;
    setConnecting(true);
    setConnectError(null);
    const result: IntegrationConnectionResult = await connectProvider("fireworks", key);
    if (result.success) {
      setIsConnected(true);
      setShowKeyInput(false);
      // Persist to localStorage for demo mode
      localStorage.setItem("observeai_fireworks_key", key);
    } else {
      setConnectError(result.error ?? "Connection failed");
    }
    setConnecting(false);
  };

  const handleDisconnect = () => {
    disconnectProvider("fireworks");
    setIsConnected(false);
    setFireworksKey("");
    localStorage.removeItem("observeai_fireworks_key");
    // Revert to mock data
    setModels(FIREWORKS_MODELS);
    setDatasets(FIREWORKS_DATASETS);
    setFinetuneJobs(FIREWORKS_FINETUNE_JOBS);
  };

  // ── Restore saved key on mount ───────────────────────────────
  useEffect(() => {
    const savedKey = localStorage.getItem("observeai_fireworks_key");
    if (savedKey) {
      (async () => {
        const result = await connectProvider("fireworks", savedKey);
        if (result.success) {
          setIsConnected(true);
          setFireworksKey(savedKey);
        }
      })();
    }
  }, []);

  // ── Fetch real data when connected ───────────────────────────
  const fetchModels = useCallback(async () => {
    const client = getClient("fireworks");
    if (!client) return;
    setLoadingModels(true);
    setFetchError(null);
    try {
      const res = await client.listModels();
      const mapped = res.data.map(apiModelToInternal);
      if (mapped.length > 0) setModels(mapped);
    } catch (err) {
      setFetchError((err as Error).message);
      // Keep mock data as fallback
    } finally {
      setLoadingModels(false);
    }
  }, []);

  const fetchDatasets = useCallback(async () => {
    const client = getClient("fireworks");
    if (!client) return;
    setLoadingDatasets(true);
    try {
      const raw = await client.listDatasets();
      if (raw.length > 0) {
        setDatasets(raw.map(apiDatasetToInternal));
      }
    } catch {
      // keep mock fallback
    } finally {
      setLoadingDatasets(false);
    }
  }, []);

  const fetchFinetuneJobs = useCallback(async () => {
    const client = getClient("fireworks");
    if (!client) return;
    setLoadingJobs(true);
    try {
      const raw = await client.listFinetuneJobs();
      if (raw.length > 0) {
        setFinetuneJobs(raw.map(apiJobToInternal));
      }
    } catch {
      // keep mock fallback
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    if (isConnected) {
      fetchModels();
      fetchDatasets();
      fetchFinetuneJobs();
    }
  }, [isConnected, fetchModels, fetchDatasets, fetchFinetuneJobs]);

  // ── Refresh all ──────────────────────────────────────────────
  const handleRefresh = () => {
    if (isConnected) {
      fetchModels();
      fetchDatasets();
      fetchFinetuneJobs();
    }
  };

  const filteredDatasets = datasets.filter(
    (d) =>
      d.name.toLowerCase().includes(datasetSearch.toLowerCase()) ||
      d.description.toLowerCase().includes(datasetSearch.toLowerCase()),
  );

  // ── Column definitions ───────────────────────────────────────
  const modelColumns = [
    {
      key: "name",
      label: "Model",
      render: (v: string, row: FireworksModel) => (
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">{v}</span>
          <Badge variant="outline" className="text-[10px]">{row.provider}</Badge>
        </div>
      ),
    },
    {
      key: "contextWindow",
      label: "Context",
      render: (v: number) => (
        <span className="font-mono text-xs text-muted-foreground">{(v / 1000).toFixed(0)}K</span>
      ),
    },
    {
      key: "pricing",
      label: "Input / Output (per 1M tokens)",
      render: (v: FireworksModel["pricing"]) => (
        <span className="font-mono text-xs text-muted-foreground">
          ${v.inputPerMillion.toFixed(2)} / ${v.outputPerMillion.toFixed(2)}
        </span>
      ),
    },
    {
      key: "id",
      label: "Model ID",
      render: (v: string) => (
        <span
          className="font-mono text-[10px] text-muted-foreground max-w-[200px] truncate block"
          title={v}
        >
          {v.split("/").pop()}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (_: unknown, row: FireworksModel) => (
        <Button variant="ghost" size="sm" disabled={!isConnected} title="Trace a test call">
          <Play className="w-3.5 h-3.5" />
        </Button>
      ),
    },
  ];

  const datasetColumns = [
    {
      key: "name",
      label: "Dataset",
      render: (v: string, row: FireworksDataset) => (
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-info" />
          <span className="text-sm font-medium text-foreground">{v}</span>
        </div>
      ),
    },
    {
      key: "rowCount",
      label: "Rows",
      render: (v: number) => (
        <span className="font-mono text-xs text-muted-foreground">{v.toLocaleString()}</span>
      ),
    },
    {
      key: "description",
      label: "Description",
      render: (v: string) => (
        <span className="text-xs text-muted-foreground max-w-[240px] truncate block">{v}</span>
      ),
    },
    {
      key: "tags",
      label: "Tags",
      render: (v: string[]) => (
        <div className="flex gap-1 flex-wrap">
          {v.map((t) => (
            <Badge key={t} variant="outline" className="text-[10px]">
              {t}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "format",
      label: "Format",
      render: (v: string) => (
        <Badge variant="secondary" className="text-[10px] uppercase">
          {v}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (_: unknown, row: FireworksDataset) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" disabled={!isConnected} title="Import into Evals">
            <FileDown className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" disabled={!isConnected} title="View on Fireworks">
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const finetuneColumns = [
    {
      key: "id",
      label: "Job ID",
      render: (v: string) => <span className="font-mono text-xs text-primary">{v}</span>,
    },
    {
      key: "baseModel",
      label: "Base Model",
      render: (v: string) => <span className="text-xs text-foreground">{v.split("/").pop()}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (v: string, row: FireworksFinetuneJob) => {
        const variant =
          v === "completed"
            ? "success"
            : v === "running"
              ? "info"
              : v === "failed"
                ? "destructive"
                : "warning";
        return (
          <div className="flex items-center gap-2">
            <Badge variant={variant as "success" | "info" | "destructive" | "warning"}>
              {v === "running" ? `${row.progress}%` : v}
            </Badge>
            {v === "running" && (
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-info rounded-full transition-all"
                  style={{ width: `${row.progress}%` }}
                />
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "metrics",
      label: "Accuracy",
      render: (v: FireworksFinetuneJob["metrics"]) =>
        v ? (
          <span className="font-mono text-xs text-foreground">{(v.accuracy * 100).toFixed(0)}%</span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
    {
      key: "createdAt",
      label: "Age",
      render: (v: number) => (
        <span className="text-xs text-muted-foreground">
          {Math.floor((Date.now() - v) / 86400000)}d ago
        </span>
      ),
    },
  ];

  return (
    <AppShell>
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Integrations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect external providers — Fireworks AI, datasets, fine-tuning, and inference
          </p>
        </div>
        {isConnected && (
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </Button>
        )}
      </div>

      {/* ── Fireworks AI Hero Card ───────────────────────────── */}
      <Card className="mb-6 overflow-hidden">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-info/5 pointer-events-none" />
          <div className="relative p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-info flex items-center justify-center shadow-lg">
                  <Rocket className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="font-heading text-lg font-bold text-foreground">Fireworks AI</h2>
                  <p className="text-sm text-muted-foreground max-w-xl">
                    High-throughput LLM inference, dataset hosting, and fine-tuning. Use your hackathon
                    credits to run models up to 405B, import eval datasets, and fine-tune custom versions.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-[10px] bg-primary/5 border-primary/20">
                      {models.length} models
                    </Badge>
                    <Badge variant="outline" className="text-[10px] bg-info/5 border-info/20">
                      {datasets.length} datasets
                    </Badge>
                    <Badge variant="outline" className="text-[10px] bg-warning/5 border-warning/20">
                      Fine-tuning
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {connecting ? (
                  <Button disabled>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Connecting…
                  </Button>
                ) : isConnected ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="success">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Connected
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={handleDisconnect}>
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <Button onClick={() => setShowKeyInput(!showKeyInput)}>
                    <Key className="w-4 h-4 mr-1.5" />
                    Connect API Key
                  </Button>
                )}
              </div>
            </div>

            {/* API Key Input */}
            {showKeyInput && !isConnected && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground mb-2">
                  Enter your Fireworks AI API key from{" "}
                  <a
                    href="https://app.fireworks.ai/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    app.fireworks.ai/api-keys
                  </a>
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    placeholder="fw_sk_..."
                    value={fireworksKey}
                    onChange={(e) => setFireworksKey(e.target.value)}
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
                  />
                  <Button onClick={handleConnect} disabled={!fireworksKey.trim() || connecting}>
                    {connecting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        Connecting
                      </>
                    ) : (
                      "Connect"
                    )}
                  </Button>
                </div>
                {connectError && (
                  <div className="flex items-center gap-2 mt-2 text-destructive text-xs">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {connectError}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 mb-4 p-1 bg-muted rounded-lg w-fit">
        {([
          { key: "providers" as const, label: "Available Models", icon: Sparkles },
          { key: "datasets" as const, label: "Datasets Hub", icon: Database },
          { key: "finetune" as const, label: "Fine-tuning", icon: FlaskConical },
        ]).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                activeTab === tab.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab: Available Models ──────────────────────────── */}
      {activeTab === "providers" && (
        <Card>
          <CardHeader
            title="Fireworks AI Models"
            subtitle={
              isConnected
                ? "Fetched from your Fireworks account"
                : "Mock data shown — connect your API key to see live models"
            }
          />
          {loadingModels ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !isConnected ? (
            <EmptyState
              icon={<Key className="w-12 h-12" />}
              title="Connect your API key to browse"
              description="Once connected, you'll see available models, pricing, and can trace test calls directly from ObserveAI."
            />
          ) : fetchError ? (
            <EmptyState
              icon={<AlertCircle className="w-12 h-12 text-destructive" />}
              title="Could not fetch models"
              description={`${fetchError}. Showing cached data.`}
            />
          ) : (
            <DataTable columns={modelColumns} data={models} />
          )}
        </Card>
      )}

      {/* ── Tab: Datasets Hub ──────────────────────────────── */}
      {activeTab === "datasets" && (
        <Card>
          <CardHeader
            title="Fireworks Datasets"
            subtitle={
              isConnected
                ? "Data from your Fireworks account"
                : "Mock data shown — connect to browse live datasets"
            }
          />
          {loadingDatasets ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !isConnected ? (
            <EmptyState
              icon={<Database className="w-12 h-12" />}
              title="Connect to browse datasets"
              description="Fireworks Dataset Hub hosts ready-to-use eval sets for prompt injection, JSON mode, QA, and more."
            />
          ) : (
            <>
              <div className="relative mb-4 px-3">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search datasets..."
                  value={datasetSearch}
                  onChange={(e) => setDatasetSearch(e.target.value)}
                  className="w-full bg-muted border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all"
                />
              </div>
              {filteredDatasets.length === 0 ? (
                <EmptyState
                  icon={<Search className="w-12 h-12" />}
                  title="No datasets match"
                  description="Try a different search term."
                />
              ) : (
                <DataTable columns={datasetColumns} data={filteredDatasets} />
              )}
              <div className="px-3 pb-3 pt-2 border-t border-border mt-2">
                <p className="text-[10px] text-muted-foreground">
                  <FileDown className="w-3 h-3 inline mr-1" />
                  Click the import icon to pull a dataset into the Evals harness
                </p>
              </div>
            </>
          )}
        </Card>
      )}

      {/* ── Tab: Fine-tuning ───────────────────────────────── */}
      {activeTab === "finetune" && (
        <Card>
          <CardHeader
            title="Fine-tuning Jobs"
            subtitle={
              isConnected
                ? "Jobs from your Fireworks account"
                : "Mock data shown — connect to view live jobs"
            }
          />
          {loadingJobs ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !isConnected ? (
            <EmptyState
              icon={<FlaskConical className="w-12 h-12" />}
              title="Connect to manage fine-tuning"
              description="View job status, metrics, and deploy fine-tuned models."
            />
          ) : (
            <>
              <DataTable columns={finetuneColumns} data={finetuneJobs} />
              <div className="px-3 pb-3 pt-3 border-t border-border mt-2">
                <Button variant="outline" size="sm">
                  <Play className="w-3.5 h-3.5 mr-1" />
                  New Fine-tuning Job
                </Button>
              </div>
            </>
          )}
        </Card>
      )}

      {/* ── Quick Stats Row ───────────────────────────────── */}
      {isConnected && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6">
          <Card className="!p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-heading text-2xl font-bold text-foreground">{models.length}</p>
                <p className="text-xs text-muted-foreground">Available models</p>
              </div>
            </div>
          </Card>
          <Card className="!p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-info/20 flex items-center justify-center">
                <Database className="w-5 h-5 text-info" />
              </div>
              <div>
                <p className="font-heading text-2xl font-bold text-foreground">{datasets.length}</p>
                <p className="text-xs text-muted-foreground">Datasets available</p>
              </div>
            </div>
          </Card>
          <Card className="!p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="font-heading text-2xl font-bold text-warning">
                  {finetuneJobs.filter((j) => j.status === "completed").length}
                </p>
                <p className="text-xs text-muted-foreground">Completed fine-tunes</p>
              </div>
            </div>
          </Card>
          <Card className="!p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="font-heading text-2xl font-bold text-success">
                  {finetuneJobs.filter((j) => j.status === "running").length}
                </p>
                <p className="text-xs text-muted-foreground">Active jobs</p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}