"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export interface PlatformEarningsPoint {
  platform: string;
  earningsUsd: number;
}

/**
 * Fixed-order categorical slots (dataviz skill) — never reassigned per
 * dataset, never cycled past what's validated for the adjacent-pair gate.
 * Five platforms comfortably clears the 8-slot ceiling.
 */
const chartConfig = {
  doordash: { label: "DoorDash", color: "var(--chart-1)" },
  uberEats: { label: "Uber Eats", color: "var(--chart-2)" },
  grubhub: { label: "Grubhub", color: "var(--chart-3)" },
  instacart: { label: "Instacart", color: "var(--chart-4)" },
  other: { label: "Other", color: "var(--chart-5)" },
} satisfies ChartConfig;

const SLOT_ORDER = ["doordash", "uberEats", "grubhub", "instacart", "other"] as const;

export function EarningsByPlatformChart({ data }: { data: PlatformEarningsPoint[] }) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
      <BarChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="platform"
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
        {/* One bar per platform, directly labeled by the X axis — no legend
            box needed (dataviz skill: direct labels before a legend when
            the category is already named on the axis). */}
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="earningsUsd" radius={[4, 4, 0, 0]} maxBarSize={24}>
          {data.map((entry, index) => (
            <Cell
              key={entry.platform}
              fill={`var(--color-${SLOT_ORDER[index % SLOT_ORDER.length]})`}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
