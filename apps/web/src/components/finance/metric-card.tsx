"use client";

import { useId } from "react";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { Area, AreaChart } from "recharts";

import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export type MetricDeltaDirection = "up" | "down" | "flat";

export interface MetricCardProps {
  /** Sentence case, no trailing colon — e.g. "Net earnings". */
  label: string;
  /** Pre-formatted by the caller (packages/shared/format) — currency/unit-aware. */
  value: string;
  /**
   * A rendered icon element (e.g. `<BanknoteIcon />`), not a component
   * reference — this card is a Client Component and most callers are Server
   * Components, which can pass rendered elements across that boundary but
   * not bare function/component references.
   */
  icon?: React.ReactNode;
  /** Pre-formatted delta text, e.g. "+$18.40 vs. previous period". */
  deltaLabel?: string;
  deltaDirection?: MetricDeltaDirection;
  /** Whether an "up" delta is good news for this metric — false for cost-per-mile. */
  isIncreaseGood?: boolean;
  /** Sparkline series, oldest first. Omit to render a plain tile. */
  trend?: { value: number }[];
  /** Exactly one "hero" tile per view (dataviz skill) — the number the page leads with. */
  size?: "default" | "hero";
  className?: string;
}

function deltaTone(
  direction: MetricDeltaDirection | undefined,
  isIncreaseGood: boolean,
): "positive" | "negative" | "muted" {
  if (!direction || direction === "flat") return "muted";
  const isGoodNews = direction === "up" ? isIncreaseGood : !isIncreaseGood;
  return isGoodNews ? "positive" : "negative";
}

/**
 * The primary financial KPI tile (net/gross earnings, miles, cost per mile,
 * earnings per mile/hour). Follows the dataviz skill's stat-tile contract:
 * proportional (non-tabular) semibold value, a signed delta colored by
 * direction × whether up is good for *this* metric (not always green-up),
 * and an optional sparkline in a single de-emphasized wash.
 */
export function MetricCard({
  label,
  value,
  icon,
  deltaLabel,
  deltaDirection,
  isIncreaseGood = true,
  trend,
  size = "default",
  className,
}: MetricCardProps) {
  const tone = deltaTone(deltaDirection, isIncreaseGood);
  const DeltaIcon =
    deltaDirection === "down" ? TrendingDownIcon : TrendingUpIcon;
  const gradientId = `metric-trend-fill-${useId().replace(/:/g, "")}`;

  return (
    <Card className={cn("gap-3 py-4", className)}>
      <CardContent className="flex items-start justify-between gap-4 px-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            {icon ? (
              <span
                className="text-muted-foreground [&>svg]:size-4 [&>svg]:shrink-0"
                aria-hidden="true"
              >
                {icon}
              </span>
            ) : null}
            <span className="text-muted-foreground text-sm">{label}</span>
          </div>
          <p
            className={cn(
              "text-metric truncate",
              size === "hero" ? "text-4xl sm:text-5xl" : "text-2xl",
            )}
          >
            {value}
          </p>
          {deltaLabel ? (
            <p
              className={cn(
                "flex items-center gap-1 text-xs font-medium",
                tone === "positive" && "text-positive",
                tone === "negative" && "text-negative",
                tone === "muted" && "text-muted-foreground",
              )}
            >
              {deltaDirection && deltaDirection !== "flat" ? (
                <DeltaIcon className="size-3.5" aria-hidden="true" />
              ) : null}
              {deltaLabel}
            </p>
          ) : null}
        </div>

        {trend && trend.length > 1 ? (
          <ChartContainer
            config={{ value: { color: "var(--primary)" } }}
            className="aspect-auto h-12 w-20 shrink-0"
          >
            <AreaChart data={trend} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--primary)"
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartContainer>
        ) : null}
      </CardContent>
    </Card>
  );
}
