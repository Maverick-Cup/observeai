import type { TooltipProps } from "recharts";

/** Shared chart colors used across dashboards */
export const CHART_COLORS = ["#3B82F6", "#22D3EE", "#8B5CF6", "#F59E0B"] as const;

/** CSS-variable-aware Tooltip style — reused everywhere to save tokens */
const STYLE: TooltipProps<any, any>["contentStyle"] = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "8px",
  color: "var(--color-foreground)",
};

export function chartTooltip(): TooltipProps<any, any>["contentStyle"] {
  return STYLE;
}