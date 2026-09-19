import { cn } from "@/lib/utils";

export interface GaugeProps {
  /** 0–100. Values outside that range are clamped. */
  value: number;
  size?: number;
  strokeWidth?: number;
  /** Any CSS color, including `var(--token)`. */
  color?: string;
  trackColor?: string;
  label?: React.ReactNode;
  sublabel?: React.ReactNode;
  className?: string;
}

/**
 * A circular progress ring with a centered value — the "how am I doing
 * against a target/reference point" visual used across Offer Analyzer and
 * the vehicle cost breakdown. Deliberately only takes a 0–100 `value`: every
 * caller is responsible for picking a meaningful normalization (percent of
 * a driver-set target, a capped cost range, etc.) rather than this
 * component inventing one.
 */
export function Gauge({
  value,
  size = 96,
  strokeWidth = 8,
  color = "var(--primary)",
  trackColor = "var(--muted)",
  label,
  sublabel,
  className,
}: GaugeProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      {label || sublabel ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-1 text-center">
          {label ? <span className="text-metric truncate text-sm leading-none">{label}</span> : null}
          {sublabel ? (
            <span className="text-muted-foreground truncate text-[10px] leading-none">{sublabel}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
