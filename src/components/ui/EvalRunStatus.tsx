import { CheckCircle2, XCircle, AlertTriangle, Loader2, FlaskConical } from "lucide-react";

interface EvalRunStatusProps {
  status: "running" | "passed" | "failed" | "regressed";
  passRate: number;
  total: number;
  label?: string;
  size?: "sm" | "md";
}

export function EvalRunStatus({
  status,
  passRate,
  total,
  label,
  size = "md",
}: EvalRunStatusProps) {
  const iconSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  const statusConfig = {
    running: {
      icon: Loader2,
      text: "Running...",
      bg: "bg-info/10 border-info/20 text-info",
      spin: true,
    },
    passed: {
      icon: CheckCircle2,
      text: "Passing",
      bg: "bg-success/10 border-success/20 text-success",
      spin: false,
    },
    failed: {
      icon: XCircle,
      text: "Failing",
      bg: "bg-destructive/10 border-destructive/20 text-destructive",
      spin: false,
    },
    regressed: {
      icon: AlertTriangle,
      text: "Regressed",
      bg: "bg-destructive/20 border-destructive/30 text-destructive font-medium",
      spin: false,
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.bg}`}>
      <Icon className={`${iconSize} ${config.spin ? "animate-spin" : ""}`} />
      <div className="flex flex-col">
        <span className={`${textSize} font-medium`}>
          {label ?? config.text}
        </span>
        <span className="text-[10px] opacity-80">
          {passRate.toFixed(1)}% · {total} {total === 1 ? "case" : "cases"}
        </span>
      </div>
    </div>
  );
}

interface EvalRegressionBadgeProps {
  delta: number;
  severity: "minor" | "major" | "critical";
  previousVersion: string;
  newVersion: string;
}

export function EvalRegressionBadge({
  delta,
  severity,
  previousVersion,
  newVersion,
}: EvalRegressionBadgeProps) {
  const severityColor = {
    minor: "bg-warning/10 text-warning border-warning/20",
    major: "bg-destructive/20 text-destructive border-destructive/30",
    critical: "bg-destructive/30 text-destructive-foreground border-destructive/50",
  };

  return (
    <div className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${severityColor[severity]}`}>
      <FlaskConical className="w-4 h-4" />
      <div className="flex flex-col text-[10px]">
        <span className="font-medium">Regression: {delta > 0 ? "+" : ""}{delta.toFixed(1)}%</span>
        <span className="opacity-70">{previousVersion} → {newVersion}</span>
      </div>
    </div>
  );
}