"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export interface TrendChartPoint {
  label: string;
  value: number;
}

/**
 * One reusable single-series area chart for Analytics' two trend lines (net
 * earnings, net $/mile) — a dataviz-skill "emphasis" chart: one hue, no
 * legend, nothing decorative layered on top. Kept generic (a label +
 * value pair, a value formatter) rather than duplicating the same Recharts
 * boilerplate per metric.
 */
export function TrendChart({
  data,
  seriesLabel,
  formatValue,
}: {
  data: TrendChartPoint[];
  seriesLabel: string;
  formatValue: (value: number) => string;
}) {
  const gradientId = `analytics-trend-fill-${useId().replace(/:/g, "")}`;
  const chartConfig = {
    value: { label: seriesLabel, color: "var(--primary)" },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-48 w-full">
      <AreaChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={56}
          tickFormatter={(v: number) => formatValue(v)}
          className="text-xs"
        />
        <ChartTooltip
          cursor={{ stroke: "var(--border)" }}
          content={<ChartTooltipContent indicator="line" formatter={(value) => formatValue(Number(value))} />}
        />
        <Area
          dataKey="value"
          type="monotone"
          stroke="var(--primary)"
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          activeDot={{ r: 4, stroke: "var(--background)", strokeWidth: 2 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
