import { useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Braces,
  DollarSign,
  Bell,
  MessageSquare,
  Bug,
  Settings,
  ArrowRight,
  TrendingUp,
  BarChart3,
  Gauge,
} from "lucide-react";
import { usePageHistory } from "../../hooks/usePageHistory";

interface Chip {
  label: string;
  icon: React.ReactNode;
  path: string;
  description?: string;
}

/** Contextual suggestions per route. */
const routeChips: Record<string, Chip[]> = {
  "/": [
    { label: "View Traces", icon: <Braces className="w-3.5 h-3.5" />, path: "/traces", description: "Inspect LLM call traces" },
    { label: "Check Alerts", icon: <Bell className="w-3.5 h-3.5" />, path: "/alerts", description: "Active alert rules" },
    { label: "Cost Analytics", icon: <DollarSign className="w-3.5 h-3.5" />, path: "/cost", description: "Spend breakdown" },
    { label: "Bad Answers", icon: <AlertTriangle className="w-3.5 h-3.5" />, path: "/bad-answers", description: "Low-quality responses" },
  ],
  "/traces": [
    { label: "Errors Only", icon: <AlertTriangle className="w-3.5 h-3.5" />, path: "/bad-answers", description: "View failed traces" },
    { label: "Dashboard", icon: <Activity className="w-3.5 h-3.5" />, path: "/", description: "Executive overview" },
    { label: "Feedback", icon: <MessageSquare className="w-3.5 h-3.5" />, path: "/feedback", description: "User feedback" },
  ],
  "/bad-answers": [
    { label: "All Traces", icon: <Braces className="w-3.5 h-3.5" />, path: "/traces", description: "Full trace list" },
    { label: "Define Rules", icon: <Bell className="w-3.5 h-3.5" />, path: "/alerts", description: "Alert on bad answers" },
    { label: "Dashboard", icon: <Activity className="w-3.5 h-3.5" />, path: "/", description: "Back to overview" },
  ],
  "/cost": [
    { label: "Model Breakdown", icon: <BarChart3 className="w-3.5 h-3.5" />, path: "/cost", description: "Per-model costs" },
    { label: "Dashboard", icon: <Activity className="w-3.5 h-3.5" />, path: "/", description: "Executive overview" },
    { label: "Trace Details", icon: <Braces className="w-3.5 h-3.5" />, path: "/traces", description: "Cost per trace" },
  ],
  "/alerts": [
    { label: "Dashboard", icon: <Activity className="w-3.5 h-3.5" />, path: "/", description: "Executive overview" },
    { label: "Bad Answers", icon: <AlertTriangle className="w-3.5 h-3.5" />, path: "/bad-answers", description: "Recent bad answers" },
    { label: "Settings", icon: <Settings className="w-3.5 h-3.5" />, path: "/settings", description: "Alert configuration" },
  ],
  "/feedback": [
    { label: "Bad Answers", icon: <AlertTriangle className="w-3.5 h-3.5" />, path: "/bad-answers", description: "Correlated bad answers" },
    { label: "Traces", icon: <Braces className="w-3.5 h-3.5" />, path: "/traces", description: "Feedback trace context" },
    { label: "Dashboard", icon: <Activity className="w-3.5 h-3.5" />, path: "/", description: "Executive overview" },
  ],
  "/dlq": [
    { label: "Retry All", icon: <Gauge className="w-3.5 h-3.5" />, path: "/dlq", description: "Process dead letters" },
    { label: "Traces", icon: <Braces className="w-3.5 h-3.5" />, path: "/traces", description: "Related trace context" },
    { label: "Alerts", icon: <Bell className="w-3.5 h-3.5" />, path: "/alerts", description: "Set DLQ alerts" },
  ],
  "/settings": [
    { label: "Dashboard", icon: <Activity className="w-3.5 h-3.5" />, path: "/", description: "Back to overview" },
    { label: "Alerts", icon: <Bell className="w-3.5 h-3.5" />, path: "/alerts", description: "Alert configuration" },
  ],
};

export function SuggestionBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { recentPages } = usePageHistory();

  // Get contextual chips for this route
  const contextualChips = routeChips[location.pathname] ?? routeChips["/"] ?? [];

  // Recent pages (excluding the current one)
  const recentChips = recentPages
    .filter((p) => p.path !== location.pathname)
    .slice(0, 3)
    .map((p) => ({
      label: p.label,
      icon: <ArrowRight className="w-3.5 h-3.5" />,
      path: p.path,
      description: "Recent page",
    }));

  // Merge: recent + contextual (deduped)
  const seen = new Set<string>();
  const merged: Chip[] = [];
  for (const chip of [...recentChips, ...contextualChips]) {
    if (!seen.has(chip.path)) {
      seen.add(chip.path);
      merged.push(chip);
    }
  }

  // Limit to a reasonable number
  const chips = merged.slice(0, 6);

  if (chips.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none" role="region" aria-label="Suggested actions">
      {chips.map((chip) => (
        <button
          key={chip.path + chip.label}
          onClick={() => navigate(chip.path)}
          title={chip.description}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/70 border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted hover:border-primary/30 transition-all duration-150 ease-out cursor-pointer whitespace-nowrap shrink-0 active:scale-95"
        >
          {chip.icon}
          <span>{chip.label}</span>
        </button>
      ))}
    </div>
  );
}