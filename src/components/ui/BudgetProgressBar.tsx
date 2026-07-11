import { TrendingUp, AlertTriangle } from "lucide-react";

interface BudgetProgressBarProps {
  budget: number;
  spent: number;
  projected: number;
  showLabels?: boolean;
  compact?: boolean;
}

export function BudgetProgressBar({
  budget,
  spent,
  projected,
  showLabels = true,
  compact = false,
}: BudgetProgressBarProps) {
  const spentPct = Math.min((spent / budget) * 100, 100);
  const projectedPct = Math.min((projected / budget) * 100, 100);
  const overshoot = projected > budget;
  const remaining = budget - spent;
  const daysLeft = Math.max(1, Math.ceil((new Date().getDate() / new Date().getDate()) * 30 - new Date().getDate()));
  const dailyBurnRate = spent / Math.max(1, new Date().getDate());

  return (
    <div className="space-y-2">
      {/* Bar */}
      <div className="relative h-3 bg-muted rounded-full overflow-hidden">
        {/* Spent bar */}
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
            spentPct >= 90 ? "bg-destructive" : spentPct >= 70 ? "bg-warning" : "bg-primary"
          }`}
          style={{ width: `${spentPct}%` }}
          role="progressbar"
          aria-valuenow={spent}
          aria-valuemin={0}
          aria-valuemax={budget}
          aria-label={`$${spent.toFixed(2)} / $${budget.toFixed(2)}`}
        />
        {/* Projected marker */}
        {projectedPct > spentPct && (
          <div
            className="absolute top-0 bottom-0 border-l-2 border-dashed border-destructive/60"
            style={{ left: `${projectedPct}%` }}
            title={`Projected: $${projected.toFixed(2)}`}
          />
        )}
      </div>

      {showLabels && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Spent</span>
            <span className="font-medium font-mono">${spent.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Budget</span>
            <span className="font-medium font-mono">${budget.toFixed(2)}</span>
          </div>
          {!compact && (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Projected</span>
                <span className={`font-mono ${overshoot ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  ${projected.toFixed(2)}
                  {overshoot && <span className="ml-1">⚠</span>}
                </span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <TrendingUp className="w-3 h-3" />
                  <span>${dailyBurnRate.toFixed(2)}/day</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span>${remaining > 0 ? remaining.toFixed(2) : "0.00"} remaining</span>
                </div>
                {overshoot && (
                  <div className="flex items-center gap-1 text-[10px] text-destructive font-medium">
                    <AlertTriangle className="w-3 h-3" />
                    <span>${(projected - budget).toFixed(2)} over</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}