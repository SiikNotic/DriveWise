"use client";

import { useTranslations } from "next-intl";
import {
  DropletIcon,
  ShieldIcon,
  TrendingDownIcon,
  MoreHorizontalIcon,
  WrenchIcon,
} from "lucide-react";
import type { VehicleOperatingCostBreakdown } from "@drivewise/shared";
import { formatUsdPerMile } from "@drivewise/shared";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Gauge } from "@/components/ui/gauge";
import { cn } from "@/lib/utils";

/**
 * Purely a visual reference point for the gauge ring below — not a
 * benchmark or judgment about whether a given cost/mile is "good". Chosen
 * as a round number comfortably above typical gig-driving operating costs
 * so the ring reads meaningfully across the range drivers actually see.
 */
const COST_GAUGE_REFERENCE_CAP_USD = 1.0;

/**
 * The itemized cost-per-mile breakdown, used both as a live preview while
 * editing a vehicle's cost inputs and as the read-only summary on its
 * details page. Never labeled as a tax figure — see the disclaimer below,
 * which is load-bearing copy, not decoration.
 */
export function CostBreakdown({
  breakdown,
  locale,
  distanceUnitLabel,
  className,
}: {
  breakdown: VehicleOperatingCostBreakdown;
  locale: string;
  distanceUnitLabel: string;
  className?: string;
}) {
  const t = useTranslations("vehicles.cost");

  const rows: { key: string; label: string; icon: typeof DropletIcon; value: number }[] = [
    { key: "fuel", label: t("fuel"), icon: DropletIcon, value: breakdown.fuelCostPerMileUsd },
    {
      key: "maintenance",
      label: t("maintenance"),
      icon: WrenchIcon,
      value: breakdown.maintenanceCostPerMileUsd,
    },
    {
      key: "depreciation",
      label: t("depreciation"),
      icon: TrendingDownIcon,
      value: breakdown.depreciationCostPerMileUsd,
    },
    {
      key: "insurance",
      label: t("insurance"),
      icon: ShieldIcon,
      value: breakdown.insuranceCostPerMileUsd,
    },
    {
      key: "other",
      label: t("other"),
      icon: MoreHorizontalIcon,
      value: breakdown.otherCostPerMileUsd,
    },
  ];

  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-center py-1">
          <Gauge
            value={(breakdown.totalCostPerMileUsd / COST_GAUGE_REFERENCE_CAP_USD) * 100}
            size={128}
            strokeWidth={10}
            label={formatUsdPerMile(breakdown.totalCostPerMileUsd, locale, distanceUnitLabel)}
            sublabel={t("total")}
          />
        </div>

        <dl className="flex flex-col gap-2.5">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground flex items-center gap-2 text-sm">
                <row.icon className="size-4 shrink-0" aria-hidden="true" />
                {row.label}
              </dt>
              <dd className="font-mono text-sm tabular-nums">
                {formatUsdPerMile(row.value, locale, distanceUnitLabel)}
              </dd>
            </div>
          ))}
        </dl>

        <Separator />

        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">{t("total")}</span>
          <span className="text-metric text-xl">
            {formatUsdPerMile(breakdown.totalCostPerMileUsd, locale, distanceUnitLabel)}
          </span>
        </div>

        <p className="text-muted-foreground text-xs">{t("disclaimer")}</p>
      </CardContent>
    </Card>
  );
}
