import { ShieldAlert, ShieldCheck, AlertTriangle } from "lucide-react";

interface InjectionFlagBadgeProps {
  count: number;
  blockedCount?: number;
  total?: number;
  size?: "sm" | "md";
}

export function InjectionFlagBadge({
  count,
  blockedCount = 0,
  total,
  size = "md",
}: InjectionFlagBadgeProps) {
  const isClear = count === 0;
  const pct = total && total > 0 ? Math.round((count / total) * 100) : 0;

  const iconSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  if (isClear) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success/10 border border-success/20">
        <ShieldCheck className={`${iconSize} text-success`} />
        <span className={`${textSize} text-success font-medium`}>No injection attempts</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20">
      <ShieldAlert className={`${iconSize} text-destructive`} />
      <div className="flex flex-col">
        <span className={`${textSize} text-destructive font-medium`}>
          {count} injection {count === 1 ? "attempt" : "attempts"}
        </span>
        {blockedCount > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {blockedCount} blocked · {count - blockedCount} flagged
          </span>
        )}
        {pct > 0 && (
          <span className="text-[10px] text-warning">
            {pct}% of total traces
          </span>
        )}
      </div>
    </div>
  );
}

interface InjectionPatternBadgeProps {
  pattern: string;
  severity: "low" | "medium" | "high" | "critical";
  onClick?: () => void;
}

export function InjectionPatternBadge({
  pattern,
  severity,
  onClick,
}: InjectionPatternBadgeProps) {
  const severityColor = {
    low: "bg-info/10 text-info border-info/20",
    medium: "bg-warning/10 text-warning border-warning/20",
    high: "bg-destructive/20 text-destructive border-destructive/30",
    critical: "bg-destructive/30 text-destructive border-destructive/50",
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium transition-all ${
        severityColor[severity]
      } cursor-pointer hover:opacity-80`}
    >
      <AlertTriangle className="w-3 h-3" />
      <span>{pattern}</span>
    </button>
  );
}