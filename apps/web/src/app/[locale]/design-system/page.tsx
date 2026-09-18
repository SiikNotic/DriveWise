import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  BanknoteIcon,
  DollarSignIcon,
  FuelIcon,
  GaugeIcon,
  RouteIcon,
  TimerIcon,
} from "lucide-react";

import {
  formatMiles,
  formatSignedUsd,
  formatUsd,
  formatUsdPerHour,
  formatUsdPerMile,
} from "@drivewise/shared";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/patterns/status-badge";
import { EmptyState, ErrorState } from "@/components/patterns/state-message";
import { MetricCard } from "@/components/finance/metric-card";
import { EarningsTrendChart } from "@/components/finance/earnings-trend-chart";
import { EarningsByPlatformChart } from "@/components/finance/earnings-by-platform-chart";
import {
  ButtonPlayground,
  InputPlayground,
  OverlayPlayground,
  TabsPlayground,
} from "@/components/design-system/playground";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

const RADII = [
  { name: "sm", className: "rounded-sm" },
  { name: "md", className: "rounded-md" },
  { name: "lg", className: "rounded-lg" },
  { name: "xl", className: "rounded-xl" },
  { name: "full", className: "rounded-full" },
];

const SPACING = [1, 2, 3, 4, 6, 8, 12, 16];

const NET_EARNINGS_TREND = [
  62, 74, 58, 91, 88, 102, 96, 110, 105, 121, 118, 130,
].map((value) => ({ value }));

const EARNINGS_PER_HOUR_TREND = [
  28, 27.2, 29.1, 26.8, 25.9, 25.1, 24.6,
].map((value) => ({ value }));

const WEEKLY_TREND = [
  { label: "Mon", netEarningsUsd: 118 },
  { label: "Tue", netEarningsUsd: 96 },
  { label: "Wed", netEarningsUsd: 142 },
  { label: "Thu", netEarningsUsd: 131 },
  { label: "Fri", netEarningsUsd: 168 },
  { label: "Sat", netEarningsUsd: 210 },
  { label: "Sun", netEarningsUsd: 187 },
];

const PLATFORM_BREAKDOWN = [
  { platform: "DoorDash", earningsUsd: 412 },
  { platform: "Uber Eats", earningsUsd: 268 },
  { platform: "Grubhub", earningsUsd: 96 },
  { platform: "Instacart", earningsUsd: 153 },
  { platform: "Other", earningsUsd: 24 },
];

export default async function DesignSystemPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("designSystem");
  const tm = await getTranslations("metrics");
  const ts = await getTranslations("status");
  const tstates = await getTranslations("states");
  const tu = await getTranslations("units");
  const mi = tu("mi");
  const hr = tu("hr");

  return (
    <div className="flex flex-col gap-10 pb-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">{t("subtitle")}</p>
      </div>

      <Section title={t("sections.typography")}>
        <Card>
          <CardContent className="flex flex-col gap-3">
            <p className="text-4xl font-semibold tracking-tight">
              Hero figure — 48px+
            </p>
            <p className="text-2xl font-semibold tracking-tight">Heading 1 — 24px</p>
            <p className="text-lg font-semibold">Heading 2 — 18px</p>
            <p className="text-base font-medium">Heading 3 — 16px</p>
            <p className="text-base">
              Body text sits at 16px with normal weight for comfortable
              reading on mobile.
            </p>
            <p className="text-muted-foreground text-sm">
              Muted / secondary text — captions, helper copy, timestamps.
            </p>
            <div className="border-t pt-3">
              <p className="text-muted-foreground text-xs">
                Proportional (hero/stat values):{" "}
                <span className="text-metric text-lg">$1,284.06</span>
              </p>
              <p className="text-muted-foreground text-xs">
                Tabular (table/list columns):{" "}
                <span className="font-tabular text-lg">$1,284.06</span> /{" "}
                <span className="font-tabular text-lg">$96.40</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section title={t("sections.spacingRadius")}>
        <Card>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-wrap items-end gap-4">
              {SPACING.map((step) => (
                <div key={step} className="flex flex-col items-center gap-1">
                  <div
                    className="bg-primary/70 rounded-sm"
                    style={{ width: step * 4, height: step * 4 }}
                  />
                  <span className="text-muted-foreground text-xs">{step * 4}px</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-4">
              {RADII.map((r) => (
                <div key={r.name} className="flex flex-col items-center gap-1">
                  <div className={`bg-primary/70 size-12 ${r.className}`} />
                  <span className="text-muted-foreground text-xs">{r.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section title={t("sections.buttons")}>
        <Card>
          <CardContent>
            <ButtonPlayground />
          </CardContent>
        </Card>
      </Section>

      <Section title={t("sections.inputs")}>
        <Card>
          <CardContent className="flex flex-col gap-6">
            <InputPlayground />
            <TabsPlayground />
          </CardContent>
        </Card>
      </Section>

      <Section title={t("sections.cards")}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            className="sm:col-span-2 lg:col-span-3"
            size="hero"
            icon={BanknoteIcon}
            label={tm("netEarnings")}
            value={formatUsd(842.16, locale)}
            deltaLabel={`${formatSignedUsd(64.2, locale)} ${tm("vsPreviousPeriod")}`}
            deltaDirection="up"
            trend={NET_EARNINGS_TREND}
          />
          <MetricCard
            icon={DollarSignIcon}
            label={tm("grossEarnings")}
            value={formatUsd(1024.5, locale)}
            deltaLabel={`${formatSignedUsd(58, locale)} ${tm("vsPreviousPeriod")}`}
            deltaDirection="up"
          />
          <MetricCard
            icon={RouteIcon}
            label={tm("miles")}
            value={formatMiles(312.4, locale, mi)}
            deltaLabel={`+${formatMiles(18.2, locale, mi)} ${tm("vsPreviousPeriod")}`}
            deltaDirection="flat"
          />
          <MetricCard
            icon={FuelIcon}
            label={tm("costPerMile")}
            value={formatUsdPerMile(0.31, locale, mi)}
            deltaLabel={`${formatSignedUsd(0.02, locale)} ${tm("vsPreviousPeriod")}`}
            deltaDirection="up"
            isIncreaseGood={false}
          />
          <MetricCard
            icon={GaugeIcon}
            label={tm("earningsPerMile")}
            value={formatUsdPerMile(1.85, locale, mi)}
            deltaLabel={`${formatSignedUsd(0.09, locale)} ${tm("vsPreviousPeriod")}`}
            deltaDirection="up"
          />
          <MetricCard
            icon={TimerIcon}
            label={tm("earningsPerHour")}
            value={formatUsdPerHour(24.6, locale, hr)}
            deltaLabel={`${formatSignedUsd(-1.1, locale)} ${tm("vsPreviousPeriod")}`}
            deltaDirection="down"
            trend={EARNINGS_PER_HOUR_TREND}
          />
        </div>
      </Section>

      <Section title={t("sections.status")}>
        <Card>
          <CardContent className="flex flex-wrap gap-2">
            <StatusBadge tone="positive">{ts("synced")}</StatusBadge>
            <StatusBadge tone="warning">{ts("pendingSync")}</StatusBadge>
            <StatusBadge tone="neutral">{ts("offline")}</StatusBadge>
            <StatusBadge tone="positive">{ts("accepted")}</StatusBadge>
            <StatusBadge tone="negative">{ts("declined")}</StatusBadge>
            <StatusBadge tone="serious">{ts("needsAttention")}</StatusBadge>
          </CardContent>
        </Card>
      </Section>

      <Section title={t("sections.overlays")}>
        <Card>
          <CardContent>
            <OverlayPlayground />
          </CardContent>
        </Card>
      </Section>

      <Section title={t("sections.states")}>
        <div className="grid gap-4 lg:grid-cols-3">
          <EmptyState
            title={t("sampleEmptyState.title")}
            description={t("sampleEmptyState.description")}
          />
          <ErrorState
            title={t("sampleErrorState.title")}
            description={t("sampleErrorState.description")}
            action={{ label: tstates("retry"), onClick: () => {} }}
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Loading</CardTitle>
              <CardDescription>Skeleton placeholder</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title={t("sections.charts")}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                {tm("netEarnings")} — 7 days
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EarningsTrendChart data={WEEKLY_TREND} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                {tm("grossEarnings")} by platform
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EarningsByPlatformChart data={PLATFORM_BREAKDOWN} />
            </CardContent>
          </Card>
        </div>
      </Section>
    </div>
  );
}
