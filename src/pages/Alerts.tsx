import { useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { Card, CardHeader } from "../components/ui/Card";
import { Badge, StatusDot } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { DataTable } from "../components/ui/DataTable";
import { useConvexQuery } from "../hooks/useConvexQuery";
import { isConvexConfigured } from "../lib/convex";
import {
  Bell, BellOff, Plus, AlertTriangle, Activity,
  Shield, ShieldAlert, DollarSign, Maximize2, Code,
} from "lucide-react";
import { CONFIG } from "../constants/config";

type RuleType = "accuracy" | "latency" | "safety" | "budget_threshold" | "injection_detection" | "schema_validation" | "context_window_overflow" | "model_drift" | "cost";

type AlertRule = {
  _id: string;
  name: string;
  ruleType: RuleType;
  metric: string;
  condition: string;
  threshold: number;
  enabled: boolean;
  severity: "critical" | "warning" | "info";
  lastTriggeredAt: number | null;
  createdAt: number;
  projectId: string;
};

type AlertEvent = {
  _id: string;
  alertRuleId: string;
  traceId: string;
  message: string;
  severity: string;
  acknowledged: boolean;
  createdAt: number;
};

const RULE_TYPE_LABELS: Record<RuleType, string> = {
  accuracy: "Accuracy",
  latency: "Latency",
  safety: "Safety",
  budget_threshold: "Budget Threshold",
  injection_detection: "Injection Detection",
  schema_validation: "Schema Validation",
  context_window_overflow: "Context Window",
  model_drift: "Model Drift",
  cost: "Cost",
};

const RULE_TYPE_ICONS: Record<RuleType, React.ReactNode> = {
  accuracy: <Activity className="w-3.5 h-3.5" />,
  latency: <Activity className="w-3.5 h-3.5" />,
  safety: <ShieldAlert className="w-3.5 h-3.5" />,
  budget_threshold: <DollarSign className="w-3.5 h-3.5" />,
  injection_detection: <Shield className="w-3.5 h-3.5" />,
  schema_validation: <Code className="w-3.5 h-3.5" />,
  context_window_overflow: <Maximize2 className="w-3.5 h-3.5" />,
  model_drift: <Activity className="w-3.5 h-3.5" />,
  cost: <DollarSign className="w-3.5 h-3.5" />,
};

const MOCK_RULES: AlertRule[] = [
  { _id: "r1", ruleType: "accuracy", name: "High Hallucination Rate", metric: "hallucination_score", condition: "<", threshold: 0.5, enabled: true, severity: "critical", lastTriggeredAt: Date.now() - 1800000, createdAt: Date.now() - 86400000, projectId: "" },
  { _id: "r2", ruleType: "latency", name: "Latency Spike", metric: "latency_ms", condition: ">", threshold: 5000, enabled: true, severity: "warning", lastTriggeredAt: Date.now() - 7200000, createdAt: Date.now() - 172800000, projectId: "" },
  { _id: "r3", ruleType: "accuracy", name: "Low Relevance Score", metric: "relevance_score", condition: "<", threshold: 0.3, enabled: true, severity: "warning", lastTriggeredAt: Date.now() - 3600000, createdAt: Date.now() - 259200000, projectId: "" },
  { _id: "r4", ruleType: "cost", name: "High Cost per Trace", metric: "cost_usd", condition: ">", threshold: 0.1, enabled: false, severity: "info", lastTriggeredAt: null, createdAt: Date.now() - 345600000, projectId: "" },
  { _id: "r5", ruleType: "safety", name: "Safety Violation", metric: "safety_score", condition: "<", threshold: 0.8, enabled: true, severity: "critical", lastTriggeredAt: Date.now() - 600000, createdAt: Date.now() - 432000000, projectId: "" },
  { _id: "r6", ruleType: "model_drift", name: "Model Drift Detected", metric: "model_drift", condition: ">", threshold: 0.15, enabled: true, severity: "warning", lastTriggeredAt: null, createdAt: Date.now() - 518400000, projectId: "" },
  // ── New rule types from CHANGELOG ──
  { _id: "r7", ruleType: "budget_threshold", name: "Monthly Budget Cap", metric: "monthly_spend", condition: ">", threshold: 4500, enabled: true, severity: "warning", lastTriggeredAt: null, createdAt: Date.now() - 604800000, projectId: "" },
  { _id: "r8", ruleType: "injection_detection", name: "Prompt Injection Attempt", metric: "injection_score", condition: ">", threshold: 0.7, enabled: true, severity: "critical", lastTriggeredAt: Date.now() - 300000, createdAt: Date.now() - 86400000, projectId: "" },
  { _id: "r9", ruleType: "schema_validation", name: "JSON Schema Failure Rate", metric: "schema_fail_rate", condition: ">", threshold: 0.05, enabled: true, severity: "warning", lastTriggeredAt: Date.now() - 7200000, createdAt: Date.now() - 172800000, projectId: "" },
  { _id: "r10", ruleType: "context_window_overflow", name: "Context Window Overflow", metric: "context_usage_pct", condition: ">", threshold: 90, enabled: true, severity: "warning", lastTriggeredAt: Date.now() - 3600000, createdAt: Date.now() - 604800000, projectId: "" },
];

const MOCK_EVENTS: AlertEvent[] = [
  { _id: "e1", alertRuleId: "r1", traceId: "trace_alert_001", message: "Hallucination score dropped to 0.32 (threshold: 0.5)", severity: "critical", acknowledged: false, createdAt: Date.now() - 1800000 },
  { _id: "e2", alertRuleId: "r5", traceId: "trace_alert_002", message: "Safety score 0.65 — potential harmful content detected", severity: "critical", acknowledged: false, createdAt: Date.now() - 600000 },
  { _id: "e3", alertRuleId: "r2", traceId: "trace_alert_003", message: "Latency exceeds 5s threshold (actual: 7.2s)", severity: "warning", acknowledged: true, createdAt: Date.now() - 7200000 },
  { _id: "e4", alertRuleId: "r3", traceId: "trace_alert_004", message: "Relevance score 0.22 — response off-topic", severity: "warning", acknowledged: true, createdAt: Date.now() - 3600000 },
];

export default function Alerts() {
  const [tab, setTab] = useState<"events" | "rules">("events");
  const [ruleFilter, setRuleFilter] = useState<RuleType | "all">("all");
  const configured = isConvexConfigured();

  const { data: realRules } = useConvexQuery<AlertRule[]>(
    configured ? "alerts:listRules" : null,
    { projectId: CONFIG.projectId },
  );
  const { data: realEvents } = useConvexQuery<AlertEvent[]>(
    configured ? "alerts:listEvents" : null,
    { projectId: CONFIG.projectId },
  );

  const rules = realRules ?? MOCK_RULES;
  const events = realEvents ?? MOCK_EVENTS;

  const filteredRules = ruleFilter === "all" ? rules : rules.filter((r) => r.ruleType === ruleFilter);
  const activeRules = rules.filter((r) => r.enabled).length;
  const unacknowledgedCount = events.filter((e) => !e.acknowledged).length;
  const firingCount = rules.filter((r) => r.enabled && r.lastTriggeredAt && (Date.now() - r.lastTriggeredAt < 86400000)).length;

  const ruleColumns = [
    { key: "name", label: "Name", render: (v: string) => <span className="font-medium text-sm">{v}</span> },
    { key: "ruleType", label: "Type", render: (v: RuleType) => (
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-accent/50 text-muted-foreground border border-border/50">
        {RULE_TYPE_ICONS[v]}
        {RULE_TYPE_LABELS[v]}
      </span>
    )},
    { key: "metric", label: "Metric", render: (v: string) => <code className="text-xs">{v}</code> },
    { key: "condition", label: "Condition", render: (v: string) => <span className="text-xs text-muted-foreground">{v}</span> },
    { key: "threadhold", label: "Threshold", render: (_: unknown, row: AlertRule) => <Badge>{row.threshold}</Badge> },
    { key: "severity", label: "Severity", render: (v: string) => <Badge variant={v as "critical" | "warning" | "info"}>{v}</Badge> },
    { key: "enabled", label: "Status", render: (v: boolean) => v ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Paused</Badge> },
    { key: "lastTriggeredAt", label: "Last Fired", render: (v: number | null) => v ? <span className="text-xs text-muted-foreground">{Math.floor((Date.now() - v) / 60000)}m ago</span> : <span className="text-xs text-muted-foreground">—</span> },
  ];

  const eventColumns = [
    { key: "severity", label: "", render: (v: string) => <StatusDot status={v === "critical" ? "error" : v === "warning" ? "warning" : "info"} /> },
    { key: "message", label: "Message", render: (v: string) => <span className="text-sm">{v}</span> },
    { key: "traceId", label: "Trace", render: (v: string) => <span className="font-mono text-xs text-primary">{v.slice(0, 14)}...</span> },
    { key: "acknowledged", label: "Status", render: (v: boolean) => v ? <Badge variant="neutral">Acknowledged</Badge> : <Badge variant="destructive">Unresolved</Badge> },
    { key: "createdAt", label: "Time", render: (v: number) => <span className="text-xs text-muted-foreground">{Math.floor((Date.now() - v) / 60000)}m ago</span> },
  ];

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Alerts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Rule-based alerts for accuracy drops, latency spikes, and safety violations
          </p>
        </div>
        <Button variant="primary" size="sm">
          <Plus className="w-4 h-4" />
          New Rule
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="font-heading text-2xl font-bold text-foreground">{firingCount}</p>
              <p className="text-xs text-muted-foreground">Firing now</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="font-heading text-2xl font-bold text-foreground">{unacknowledgedCount}</p>
              <p className="text-xs text-muted-foreground">Unresolved events</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-info/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="font-heading text-2xl font-bold text-foreground">{activeRules} / {rules.length}</p>
              <p className="text-xs text-muted-foreground">Active rules</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 mb-4 bg-muted p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab("events")}
          className={`px-4 py-1.5 text-sm rounded-md transition-all ${
            tab === "events" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Alert Events
        </button>
        <button
          onClick={() => setTab("rules")}
          className={`px-4 py-1.5 text-sm rounded-md transition-all ${
            tab === "rules" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Alert Rules
        </button>
      </div>

      {/* Tab Content */}
      {tab === "events" && (
        <Card>
          <CardHeader title="Recent Alert Events" subtitle="Latest triggered alerts" />
          {events.length === 0 ? (
            <EmptyState
              icon={<BellOff className="w-12 h-12" />}
              title="All clear"
              description="No alerts triggered. Rules are actively monitoring your traces."
            />
          ) : (
            <DataTable columns={eventColumns} data={events} />
          )}
        </Card>
      )}

      {tab === "rules" && (
        <Card>
          <CardHeader title="Alert Rules" subtitle="Configure monitoring thresholds" />
          {rules.length === 0 ? (
            <EmptyState
              icon={<Bell className="w-12 h-12" />}
              title="No alert rules configured"
              description="Create rules to get notified when trace quality drops below thresholds."
              action={<Button variant="primary"><Plus className="w-4 h-4" /> Create Rule</Button>}
            />
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
              <button onClick={() => setRuleFilter("all")} className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${ruleFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>All</button>
              {(Object.keys(RULE_TYPE_LABELS) as RuleType[]).map((rt) => (
                <button key={rt} onClick={() => setRuleFilter(rt)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-colors ${ruleFilter === rt ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
                  {RULE_TYPE_ICONS[rt]}
                  {RULE_TYPE_LABELS[rt]}
                </button>
              ))}
            </div>
            <DataTable columns={ruleColumns} data={filteredRules} />
            </>
          )}
        </Card>
      )}
    </AppShell>
  );
}