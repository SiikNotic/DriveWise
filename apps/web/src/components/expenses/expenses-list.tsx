"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CarIcon,
  DropletIcon,
  HammerIcon,
  MoreHorizontalIcon,
  PlusIcon,
  ShieldIcon,
  SquareParkingIcon,
  TicketIcon,
  WrenchIcon,
} from "lucide-react";
import { SyncQueue, formatUsd, type ExpenseCategory } from "@drivewise/shared";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StatusBadge, type StatusTone } from "@/components/patterns/status-badge";
import { EmptyState } from "@/components/patterns/state-message";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { IndexedDbExpenseStore } from "@/lib/expenses/indexeddb-expense-store";
import { SupabaseExpenseTransport } from "@/lib/expenses/supabase-expense-transport";
import { fetchExpenseRows, type ExpenseListRow } from "@/lib/expenses/expense-source";
import { EXPENSE_CATEGORIES } from "@/lib/expenses/types";
import { DeleteExpenseDialog } from "@/components/expenses/delete-expense-dialog";

const REFRESH_INTERVAL_MS = 30_000;

const SYNC_TONE: Record<ExpenseListRow["syncStatus"], StatusTone> = {
  local: "neutral",
  pending: "warning",
  syncing: "warning",
  synced: "positive",
  failed: "serious",
};

/** One color-coded icon per category — a quick visual scan cue in the list, matching each category's own semantics rather than an arbitrary palette. */
const CATEGORY_STYLE: Record<
  ExpenseCategory,
  { icon: typeof DropletIcon; className: string }
> = {
  fuel: { icon: DropletIcon, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" },
  maintenance: { icon: WrenchIcon, className: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400" },
  repairs: { icon: HammerIcon, className: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400" },
  insurance: { icon: ShieldIcon, className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400" },
  tolls: { icon: TicketIcon, className: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400" },
  parking: { icon: SquareParkingIcon, className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-400" },
  car_wash: { icon: CarIcon, className: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400" },
  other: { icon: MoreHorizontalIcon, className: "bg-secondary text-muted-foreground" },
};

export function ExpensesList({
  userId,
  vehicles,
}: {
  userId: string;
  vehicles: { id: string; nickname: string }[];
}) {
  const t = useTranslations("expenses");
  const ts = useTranslations("expenses.syncStatus");
  const locale = useLocale();
  const isOnline = useOnlineStatus();

  const [rows, setRows] = useState<ExpenseListRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const vehicleName = useMemo(() => new Map(vehicles.map((v) => [v.id, v.nickname])), [vehicles]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const result = await fetchExpenseRows(userId);
    setRows(result);
    setLoaded(true);
  }, [userId]);

  useEffect(() => {
    const store = new IndexedDbExpenseStore();
    const syncQueue = new SyncQueue({
      store,
      transport: new SupabaseExpenseTransport(),
      isOnline: () => navigator.onLine,
    });

    async function drainAndRefresh() {
      await syncQueue.runOnce(userId);
      await refresh();
    }

    void drainAndRefresh();
    const interval = setInterval(() => void drainAndRefresh(), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [userId, refresh]);

  useEffect(() => {
    // Fetching from IndexedDB/Supabase (external systems) and syncing the
    // result into state is exactly what this effect is for — same pattern
    // as trips-list.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isOnline) void refresh();
  }, [isOnline, refresh]);

  const monthlyTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of rows) {
      const monthKey = row.incurredOn.slice(0, 7);
      totals.set(monthKey, (totals.get(monthKey) ?? 0) + row.amountUsd);
    }
    return [...totals.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
  }, [rows]);

  const categoryTotals = useMemo(() => {
    const totals = new Map<ExpenseCategory, number>();
    for (const row of rows) {
      totals.set(row.category, (totals.get(row.category) ?? 0) + row.amountUsd);
    }
    return totals;
  }, [rows]);

  const monthFormat = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" });
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <Button asChild>
          <Link href="/expenses/new">
            <PlusIcon />
            {t("addExpense")}
          </Link>
        </Button>
      </div>

      {!isOnline ? (
        <Alert variant="warning">
          <AlertDescription>{t("offlineNotice")}</AlertDescription>
        </Alert>
      ) : null}

      {!loaded ? (
        <p className="text-muted-foreground text-center text-sm">{t("empty.title")}</p>
      ) : rows.length === 0 ? (
        <EmptyState title={t("empty.title")} description={t("empty.description")} />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("monthlyTotals")}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="flex flex-col gap-2">
                  {monthlyTotals.map(([monthKey, total]) => (
                    <div key={monthKey} className="flex items-center justify-between gap-2 text-sm">
                      <dt className="text-muted-foreground">
                        {monthFormat.format(new Date(`${monthKey}-01T00:00:00`))}
                      </dt>
                      <dd className="font-mono tabular-nums">{formatUsd(total, locale)}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("categoryTotals")}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="flex flex-col gap-2">
                  {EXPENSE_CATEGORIES.filter((category) => categoryTotals.has(category)).map((category) => (
                    <div key={category} className="flex items-center justify-between gap-2 text-sm">
                      <dt className="text-muted-foreground">{t(`category.${category}`)}</dt>
                      <dd className="font-mono tabular-nums">{formatUsd(categoryTotals.get(category)!, locale)}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-2">
            {rows.map((row) => {
              const { icon: CategoryIcon, className: categoryClassName } = CATEGORY_STYLE[row.category];
              return (
                <Card key={row.clientId} className="gap-3 py-3">
                  <CardContent className="flex items-center gap-3 px-4">
                    <span
                      className={`grid size-10 shrink-0 place-items-center rounded-full ${categoryClassName}`}
                      aria-hidden="true"
                    >
                      <CategoryIcon className="size-5" />
                    </span>
                    <Link
                      href={`/expenses/${row.clientId}/edit`}
                      className="flex min-w-0 flex-1 flex-col gap-1 hover:opacity-80"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{t(`category.${row.category}`)}</span>
                        <span className="text-muted-foreground text-xs">
                          {dateFormat.format(new Date(`${row.incurredOn}T00:00:00`))}
                        </span>
                      </div>
                      <span className="text-muted-foreground truncate text-xs">
                        {row.vehicleId ? vehicleName.get(row.vehicleId) : null}
                        {row.vehicleId && row.description ? " · " : null}
                        {row.description}
                      </span>
                    </Link>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="text-metric text-sm">{formatUsd(row.amountUsd, locale)}</span>
                      <div className="flex items-center gap-1.5">
                        <StatusBadge tone={SYNC_TONE[row.syncStatus]}>{ts(row.syncStatus)}</StatusBadge>
                        <DeleteExpenseDialog row={row} onDeleted={refresh} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
