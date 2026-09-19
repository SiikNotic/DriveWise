import { cn } from "@/lib/utils";

export interface DonutSegment {
  value: number;
  color: string;
}

export interface DonutGaugeProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
  centerLabel?: React.ReactNode;
  centerSublabel?: React.ReactNode;
  className?: string;
}

/**
 * A multi-segment ring — the composition view (miles by trip purpose,
 * spend by category, ...) that a single `Gauge` ring can't express. Each
 * segment's arc length is its share of the total; a zero-value segment is
 * skipped rather than rendered as a zero-length arc.
 */
export function DonutGauge({
  segments,
  size = 140,
  strokeWidth = 16,
  trackColor = "var(--muted)",
  centerLabel,
  centerSublabel,
  className,
}: DonutGaugeProps) {
  const total = segments.reduce((sum, segment) => sum + Math.max(segment.value, 0), 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativeFraction = 0;

  return (
    <div
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        {total > 0
          ? segments
              .filter((segment) => segment.value > 0)
              .map((segment, index) => {
                const fraction = segment.value / total;
                const dashLength = fraction * circumference;
                const offset = -cumulativeFraction * circumference;
                cumulativeFraction += fraction;
                return (
                  <circle
                    key={index}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                    strokeDashoffset={offset}
                    style={{ transition: "stroke-dasharray 0.5s ease, stroke-dashoffset 0.5s ease" }}
                  />
                );
              })
          : null}
      </svg>
      {centerLabel || centerSublabel ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-2 text-center">
          {centerLabel ? <span className="text-metric truncate text-lg leading-none">{centerLabel}</span> : null}
          {centerSublabel ? (
            <span className="text-muted-foreground truncate text-[11px] leading-none">{centerSublabel}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
