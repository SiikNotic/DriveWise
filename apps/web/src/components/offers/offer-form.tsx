"use client";

import { useActionState, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { CarIcon, InfoIcon } from "lucide-react";
import {
  analyzeDeliveryOffer,
  formatMiles,
  formatUsd,
  formatUsdPerHour,
  formatUsdPerMile,
} from "@drivewise/shared";

import { saveOfferDecisionAction } from "@/lib/offers/actions";
import { initialOfferActionState } from "@/lib/offers/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Gauge } from "@/components/ui/gauge";
import { StatusBadge } from "@/components/patterns/status-badge";
import { SubmitButton } from "@/components/forms/submit-button";
import { ThresholdsForm } from "@/components/offers/thresholds-form";

function toNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function OfferForm({
  vehicleId,
  costPerMileUsd,
  minHourlyEarningsUsd,
  minPerMileEarningsUsd,
  distanceUnitLabel,
  hourUnitLabel,
  minuteUnitLabel,
}: {
  vehicleId: string | null;
  costPerMileUsd: number | null;
  minHourlyEarningsUsd: number;
  minPerMileEarningsUsd: number;
  distanceUnitLabel: string;
  hourUnitLabel: string;
  minuteUnitLabel: string;
}) {
  const t = useTranslations("offers");
  const tf = useTranslations("offers.fields");
  const tr = useTranslations("offers.result");
  const th = useTranslations("offers.howCalculated");
  const tfa = useTranslations("offers.factors");
  const tc = useTranslations("common");
  const tn = useTranslations("notifications");
  const locale = useLocale();

  const [pay, setPay] = useState("");
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [returnDistance, setReturnDistance] = useState("");
  const [waitMinutes, setWaitMinutes] = useState("");

  const [acceptState, acceptAction] = useActionState(
    saveOfferDecisionAction,
    initialOfferActionState,
  );
  const [declineState, declineAction] = useActionState(
    saveOfferDecisionAction,
    initialOfferActionState,
  );

  useEffect(() => {
    if (acceptState?.success) toast(tn("offerSaved"));
  }, [acceptState?.success, tn]);
  useEffect(() => {
    if (declineState?.success) toast(tn("offerSaved"));
  }, [declineState?.success, tn]);

  const payoutUsd = toNumber(pay);
  const distanceMiles = toNumber(distance);
  const durationMinutes = toNumber(duration);
  const returnMiles = toNumber(returnDistance);
  const extraWaitMinutes = toNumber(waitMinutes);

  const isReady =
    payoutUsd !== null && payoutUsd > 0 && distanceMiles !== null && distanceMiles > 0 && durationMinutes !== null && durationMinutes > 0;

  const analysis = isReady
    ? analyzeDeliveryOffer({
        offeredPayUsd: payoutUsd,
        estimatedDistanceMiles: distanceMiles,
        estimatedDurationMinutes: durationMinutes,
        estimatedReturnDistanceMiles: returnMiles,
        additionalWaitMinutes: extraWaitMinutes,
        costPerMileUsd: costPerMileUsd ?? 0,
        minHourlyEarningsUsd,
        minPerMileEarningsUsd,
      })
    : null;

  const numberFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });

  return (
    <div className="flex flex-col gap-4">
      {costPerMileUsd === null ? (
        <Alert variant="warning">
          <CarIcon />
          <AlertDescription>{t("noActiveVehicle")}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-6 sm:grid-cols-3">
          <div className="col-span-2 grid gap-1.5 sm:col-span-1">
            <Label htmlFor="offer-pay" className="text-base">
              {tf("pay")}
            </Label>
            <Input
              id="offer-pay"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              autoFocus
              className="h-14 text-2xl font-semibold"
              value={pay}
              onChange={(event) => setPay(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="offer-distance" className="text-base">
              {tf("distance")}
            </Label>
            <Input
              id="offer-distance"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              className="h-14 text-2xl font-semibold"
              value={distance}
              onChange={(event) => setDistance(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="offer-duration" className="text-base">
              {tf("duration")}
            </Label>
            <Input
              id="offer-duration"
              type="number"
              inputMode="decimal"
              step="1"
              min="0"
              className="h-14 text-2xl font-semibold"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="offer-return-distance">
              {tf("returnDistance")} <span className="text-muted-foreground">({tc("optional")})</span>
            </Label>
            <Input
              id="offer-return-distance"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={returnDistance}
              onChange={(event) => setReturnDistance(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="offer-wait-minutes">
              {tf("waitMinutes")} <span className="text-muted-foreground">({tc("optional")})</span>
            </Label>
            <Input
              id="offer-wait-minutes"
              type="number"
              inputMode="decimal"
              step="1"
              min="0"
              value={waitMinutes}
              onChange={(event) => setWaitMinutes(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {!analysis ? (
        <p className="text-muted-foreground text-center text-sm">{t("empty.description")}</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{tr("title")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">{tr("estimatedNet")}</span>
                <span className="text-metric text-4xl">
                  {formatUsd(analysis.estimatedNetUsd, locale)}
                </span>
              </div>

              {/* Two gauges — each ring's fill is the offer's actual rate as a
                  percentage of *your* saved minimum target (capped visually
                  at 100%), not an arbitrary scale, so "full and green" always
                  means "meets or beats what you told DriveWise you need". */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col items-center gap-2">
                  <Gauge
                    value={
                      minHourlyEarningsUsd > 0
                        ? (analysis.estimatedNetHourlyUsd / minHourlyEarningsUsd) * 100
                        : 100
                    }
                    color={analysis.meetsHourlyTarget ? "var(--positive)" : "var(--warning)"}
                    label={formatUsdPerHour(analysis.estimatedNetHourlyUsd, locale, hourUnitLabel)}
                    sublabel={tr("netPerHour")}
                    size={104}
                  />
                  <StatusBadge tone={analysis.meetsHourlyTarget ? "positive" : "negative"}>
                    {tfa(analysis.meetsHourlyTarget ? "hourlyMet" : "hourlyBelow")}
                  </StatusBadge>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Gauge
                    value={
                      minPerMileEarningsUsd > 0
                        ? (analysis.netEarningsPerMileUsd / minPerMileEarningsUsd) * 100
                        : 100
                    }
                    color={analysis.meetsPerMileTarget ? "var(--positive)" : "var(--warning)"}
                    label={formatUsdPerMile(analysis.netEarningsPerMileUsd, locale, distanceUnitLabel)}
                    sublabel={tr("netPerMile")}
                    size={104}
                  />
                  <StatusBadge tone={analysis.meetsPerMileTarget ? "positive" : "negative"}>
                    {tfa(analysis.meetsPerMileTarget ? "perMileMet" : "perMileBelow")}
                  </StatusBadge>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground text-xs">{tr("grossPerHour")}</span>
                  <span className="text-metric text-lg">
                    {formatUsdPerHour(analysis.estimatedGrossHourlyUsd, locale, hourUnitLabel)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground text-xs">{tr("grossPerMile")}</span>
                  <span className="text-metric text-lg">
                    {formatUsdPerMile(analysis.grossEarningsPerMileUsd, locale, distanceUnitLabel)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{th("title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground text-sm">{tr("grossPayout")}</dt>
                  <dd className="font-mono text-sm tabular-nums">
                    {formatUsd(analysis.grossPayoutUsd, locale)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground text-sm">{th("totalMiles")}</dt>
                  <dd className="font-mono text-sm tabular-nums">
                    {formatMiles(analysis.totalMiles, locale, distanceUnitLabel)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground text-sm">{th("totalTime")}</dt>
                  <dd className="font-mono text-sm tabular-nums">
                    {numberFormat.format(analysis.totalMinutes)} {minuteUnitLabel}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground text-sm">{th("vehicleCost")}</dt>
                  <dd className="font-mono text-sm tabular-nums">
                    {formatUsd(analysis.vehicleCostUsd, locale)}
                  </dd>
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-sm font-semibold">{th("estimatedNet")}</dt>
                  <dd className="font-mono text-sm font-semibold tabular-nums">
                    {formatUsd(analysis.estimatedNetUsd, locale)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground text-sm">{th("grossPerMile")}</dt>
                  <dd className="font-mono text-sm tabular-nums">
                    {formatUsdPerMile(analysis.grossEarningsPerMileUsd, locale, distanceUnitLabel)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground text-sm">{th("netPerMile")}</dt>
                  <dd className="font-mono text-sm tabular-nums">
                    {formatUsdPerMile(analysis.netEarningsPerMileUsd, locale, distanceUnitLabel)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground text-sm">{th("grossPerHour")}</dt>
                  <dd className="font-mono text-sm tabular-nums">
                    {formatUsdPerHour(analysis.estimatedGrossHourlyUsd, locale, hourUnitLabel)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground text-sm">{th("netPerHour")}</dt>
                  <dd className="font-mono text-sm tabular-nums">
                    {formatUsdPerHour(analysis.estimatedNetHourlyUsd, locale, hourUnitLabel)}
                  </dd>
                </div>
              </dl>

              <p className="text-muted-foreground mt-4 text-xs">{t("disclaimer")}</p>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <form action={acceptAction}>
              <input type="hidden" name="decision" value="accepted" />
              <input type="hidden" name="offeredPayUsd" value={payoutUsd ?? ""} />
              <input type="hidden" name="estimatedDistanceMiles" value={distanceMiles ?? ""} />
              <input type="hidden" name="estimatedDurationMinutes" value={durationMinutes ?? ""} />
              <input type="hidden" name="estimatedReturnDistanceMiles" value={returnMiles ?? ""} />
              <input type="hidden" name="additionalWaitMinutes" value={extraWaitMinutes ?? ""} />
              <input type="hidden" name="vehicleId" value={vehicleId ?? ""} />
              <SubmitButton pendingChildren={t("accept")}>{t("accept")}</SubmitButton>
            </form>
            <form action={declineAction}>
              <input type="hidden" name="decision" value="declined" />
              <input type="hidden" name="offeredPayUsd" value={payoutUsd ?? ""} />
              <input type="hidden" name="estimatedDistanceMiles" value={distanceMiles ?? ""} />
              <input type="hidden" name="estimatedDurationMinutes" value={durationMinutes ?? ""} />
              <input type="hidden" name="estimatedReturnDistanceMiles" value={returnMiles ?? ""} />
              <input type="hidden" name="additionalWaitMinutes" value={extraWaitMinutes ?? ""} />
              <input type="hidden" name="vehicleId" value={vehicleId ?? ""} />
              <SubmitButton pendingChildren={t("decline")} variant="outline">
                {t("decline")}
              </SubmitButton>
            </form>
          </div>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <InfoIcon className="text-muted-foreground size-4" aria-hidden="true" />
            {t("targets.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ThresholdsForm
            minHourlyEarningsUsd={minHourlyEarningsUsd}
            minPerMileEarningsUsd={minPerMileEarningsUsd}
            compact
          />
        </CardContent>
      </Card>
    </div>
  );
}
