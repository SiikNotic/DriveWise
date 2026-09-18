"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export interface EarningsTrendPoint {
  /** Short axis label, e.g. a weekday abbreviation — already localized by the caller. */
  label: string;
  netEarningsUsd: number;
}

const chartConfig = {
  netEarningsUsd: {
    label: "Net earnings",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

/**
 * A single series (net earnings over time) is an "emphasis" chart per the
 * dataviz skill: one hue (the brand accent), no legend needed — the title
 * already names what's plotted. Never pair this with a second y-axis.
 */
export function EarningsTrendChart({ data }: { data: EarningsTrendPoint[] }) {
  const gradientId = `earnings-trend-fill-${useId().replace(/:/g, "")}`;

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
      <AreaChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          className="text-xs"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={48}
          tickFormatter={(v: number) => `$${v}`}
          className="text-xs"
        />
        <ChartTooltip
          cursor={{ stroke: "var(--border)" }}
          content={<ChartTooltipContent indicator="line" />}
        />
        <Area
          dataKey="netEarningsUsd"
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
