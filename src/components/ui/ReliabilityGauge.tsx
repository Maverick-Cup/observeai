import { useId } from "react";

interface ReliabilityGaugeProps {
  score: number; // 0–100
  size?: "sm" | "md" | "lg";
  label?: string;
  showLabel?: boolean;
}

const sizeMap = { sm: 80, md: 120, lg: 160 };
const strokeMap = { sm: 6, md: 8, lg: 10 };
const textMap = { sm: "text-xs", md: "text-base", lg: "text-xl" };
const subTextMap = { sm: "text-[8px]", md: "text-[10px]", lg: "text-xs" };

function scoreColor(score: number) {
  if (score >= 90) return "var(--color-success, #22c55e)";
  if (score >= 70) return "var(--color-warning, #f59e0b)";
  return "var(--color-destructive, #ef4444)";
}

export function ReliabilityGauge({
  score,
  size = "md",
  label = "Reliability",
  showLabel = true,
}: ReliabilityGaugeProps) {
  const id = useId();
  const dim = sizeMap[size];
  const stroke = strokeMap[size];
  const radius = dim / 2 - stroke / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={dim}
        height={dim}
        viewBox={`0 0 ${dim} ${dim}`}
        className="transform -rotate-90"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${score}%`}
      >
        {/* Background circle */}
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          fill="none"
          stroke="var(--color-muted, #e5e7eb)"
          strokeWidth={stroke}
        />
        {/* Progress arc */}
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
        />
        {/* Center text (rotated back) */}
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className={textMap[size]}
          fill="currentColor"
          fontWeight="bold"
          transform={`rotate(90, ${dim / 2}, ${dim / 2})`}
        >
          {Math.round(score)}%
        </text>
      </svg>
      {showLabel && (
        <span className={`${subTextMap[size]} text-muted-foreground`}>
          {label}
        </span>
      )}
    </div>
  );
}