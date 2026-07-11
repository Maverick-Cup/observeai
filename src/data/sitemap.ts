/**
 * Portal Sitemap — the tour guide index of every page in ObserveAI.
 *
 * Each entry maps to a route and carries rich metadata so the global
 * search can match on labels, descriptions, tags, and keywords.
 */

export interface SitemapEntry {
  path: string;
  label: string;
  description: string;
  /** Lucide icon name — used dynamically in the search UI */
  icon: string;
  /** Functional category for grouping search results */
  category: "Observability" | "Quality" | "Operations" | "Configuration" | "Testing";
  tags: string[];
  keywords: string[];
}

const SITEMAP: SitemapEntry[] = [
  {
    path: "/",
    label: "Dashboard",
    description: "High-level overview of everything — active problems, recent traces, cost burn, reliability score, and the health of your LLM stack at a glance.",
    icon: "LayoutDashboard",
    category: "Observability",
    tags: ["overview", "home", "landing", "summary"],
    keywords: ["dashboard", "home", "overview", "kpis", "metrics", "summary", "health"],
  },
  {
    path: "/bad-answers",
    label: "Bad Answers",
    description: "Flagged responses that failed quality checks — toxic output, hallucinations, off-topic replies, or policy violations. Review, label, and trace each one back to the root cause.",
    icon: "AlertTriangle",
    category: "Quality",
    tags: ["quality", "toxicity", "hallucination", "flagged", "issues"],
    keywords: ["bad answers", "flagged", "toxic", "hallucination", "off-topic", "policy", "quality"],
  },
  {
    path: "/traces",
    label: "Traces",
    description: "Full trace explorer — drill into every LLM call, see prompt/response pairs, token usage, latency breakdowns, and metadata. Supports deep search and filtering.",
    icon: "Braces",
    category: "Observability",
    tags: ["traces", "spans", "prompts", "responses", "debugging"],
    keywords: ["traces", "spans", "prompts", "debug", "requests", "llm calls", "history"],
  },
  {
    path: "/cost",
    label: "Cost Analytics",
    description: "Track spending across models, projects, and time windows. See cost-per-token trends, budget thresholds, and provider-level breakdowns to keep your LLM bills in check.",
    icon: "DollarSign",
    category: "Operations",
    tags: ["cost", "billing", "budget", "spend", "pricing"],
    keywords: ["cost", "pricing", "spend", "budget", "billing", "tokens", "provider"],
  },
  {
    path: "/alerts",
    label: "Alerts",
    description: "Configure and manage alert rules — get notified when error rates spike, latency exceeds thresholds, budgets are breached, or reliability dips below your SLA.",
    icon: "Bell",
    category: "Operations",
    tags: ["alerts", "notifications", "rules", "thresholds"],
    keywords: ["alerts", "notifications", "rules", "thresholds", "sla", "incidents"],
  },
  {
    path: "/feedback",
    label: "Feedback",
    description: "User-submitted feedback on LLM responses — thumbs up/down, comments, and flags. Aggregate sentiment, spot patterns, and close the loop on model quality.",
    icon: "MessageSquare",
    category: "Quality",
    tags: ["feedback", "ratings", "user sentiment", "reviews"],
    keywords: ["feedback", "ratings", "thumbs", "user feedback", "sentiment", "comments", "review"],
  },
  {
    path: "/dlq",
    label: "DLQ Manager",
    description: "Dead Letter Queue — events that failed processing. Replay, inspect, or purge failed ingestion records to keep your pipeline clean.",
    icon: "Bug",
    category: "Operations",
    tags: ["dlq", "failed events", "replay", "errors"],
    keywords: ["dlq", "dead letter", "failed", "replay", "retry", "errors", "pipeline"],
  },
  {
    path: "/settings",
    label: "Settings",
    description: "Account, project, and team configuration — manage users, API keys, notification preferences, billing details, and theme toggle.",
    icon: "Settings",
    category: "Configuration",
    tags: ["settings", "preferences", "account", "team"],
    keywords: ["settings", "preferences", "account", "profile", "team", "api keys", "theme"],
  },
  {
    path: "/stress-test",
    label: "Stress Lab",
    description: "Load-test your LLM endpoints — simulate concurrent users, ramp up traffic, measure p95 latency, throughput, and error rates under pressure.",
    icon: "FlaskConical",
    category: "Testing",
    tags: ["load testing", "benchmark", "performance", "throughput"],
    keywords: ["stress test", "load", "benchmark", "performance", "throughput", "concurrent", "latency"],
  },
  {
    path: "/reliability",
    label: "Reliability",
    description: "Reliability scoring and analysis — per-model uptime, error budgets, SLA compliance, and trend charts. Get automated fix suggestions when scores dip.",
    icon: "Shield",
    category: "Observability",
    tags: ["reliability", "uptime", "sla", "error budget"],
    keywords: ["reliability", "uptime", "sla", "error budget", "score", "fix suggestions"],
  },
  {
    path: "/evals",
    label: "Evals",
    description: "Evaluation suites — run and compare model outputs against test datasets. Track pass/fail rates, regression diffs, and prompt version performance.",
    icon: "CheckSquare",
    category: "Quality",
    tags: ["evals", "evaluations", "testing", "regression"],
    keywords: ["evals", "evaluations", "tests", "benchmarks", "regression", "prompt version"],
  },
  {
    path: "/guardrails",
    label: "Guardrails",
    description: "Policy guardrails — define content filters, topic boundaries, and safety rules. Enforce them across every LLM call and see violation heatmaps.",
    icon: "Shield",
    category: "Quality",
    tags: ["guardrails", "policies", "safety", "content filters"],
    keywords: ["guardrails", "policies", "safety", "content filter", "topic", "violation"],
  },
  {
    path: "/reports",
    label: "Reports",
    description: "Weekly reports with personality — The Weekly Roast, Vibe Check, Blame the Team. Exportable charts and summaries of your LLM stack's performance, cost, and quality trends.",
    icon: "FileText",
    category: "Operations",
    tags: ["reports", "weekly", "analytics", "export"],
    keywords: ["reports", "weekly roast", "vibe check", "export", "pdf", "charts", "analytics"],
  },
  {
    path: "/context",
    label: "Context Monitor",
    description: "Context window usage across models — track prompt sizes, token budgets, truncation rates, and sliding-window patterns to optimise context efficiency.",
    icon: "Maximize2",
    category: "Observability",
    tags: ["context", "tokens", "window", "prompt size"],
    keywords: ["context", "window", "tokens", "prompt size", "truncation", "sliding window"],
  },
  {
    path: "/schema",
    label: "Schema Registry",
    description: "Manage and version your event schemas — define validation rules, track schema evolution, and see which integrations are using each version.",
    icon: "Database",
    category: "Configuration",
    tags: ["schema", "validation", "registry", "versioning"],
    keywords: ["schema", "registry", "validation", "versioning", "evolve", "integration"],
  },
  {
    path: "/ingestion",
    label: "Ingestion Pipeline",
    description: "Data ingestion hub — ship events via REST, Syslog, OpenTelemetry, or CSV. Monitor throughput, error rates, pipeline health, and manage API keys for external integrations.",
    icon: "Network",
    category: "Operations",
    tags: ["ingestion", "pipeline", "data", "webhooks", "api keys"],
    keywords: ["ingestion", "pipeline", "webhooks", "api keys", "events", "data", "import", "export"],
  },
  {
    path: "/integrations",
    label: "Integrations",
    description: "Connect external providers — Fireworks AI models, dataset hub, and fine-tuning. Browse models, import eval datasets, and track fine-tuning jobs.",
    icon: "Puzzle",
    category: "Configuration",
    tags: ["integrations", "fireworks", "models", "datasets", "fine-tuning", "providers"],
    keywords: ["integrations", "fireworks", "fireworks ai", "models", "datasets", "fine-tune", "providers", "llm"],
  },
];

export default SITEMAP;