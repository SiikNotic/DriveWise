"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  CarIcon,
  InfoIcon,
  PauseIcon,
  PlayIcon,
  SquareIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { formatDuration, formatMiles, type TripPurpose } from "@drivewise/shared";

import { useTripRecorder } from "@/hooks/use-trip-recorder";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StatusBadge, type StatusTone } from "@/components/patterns/status-badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PURPOSES: TripPurpose[] = ["business", "personal", "commute"];

const GPS_TONE: Record<string, StatusTone> = {
  active: "positive",
  searching: "warning",
  weak: "serious",
  permission_denied: "negative",
  unsupported: "neutral",
  idle: "neutral",
};

export function TrackingPanel({
  userId,
  vehicles,
  distanceUnitLabel,
}: {
  userId: string;
  vehicles: { id: string; nickname: string }[];
  distanceUnitLabel: string;
}) {
  const t = useTranslations("tracking");
  const tp = useTranslations("trips.purpose");
  const tc = useTranslations("common");
  const tn = useTranslations("notifications");
  const te = useTranslations("errors");
  const locale = useLocale();

  const { snapshot, justRecovered, start, pause, resume, stop, discard } = useTripRecorder(userId);
  const isOnline = useOnlineStatus();

  const [purpose, setPurpose] = useState<TripPurpose>("business");
  const [vehicleId, setVehicleId] = useState<string>("");
  const [confirmAction, setConfirmAction] = useState<"stop" | "discard" | null>(null);
  const [busy, setBusy] = useState(false);

  const isIdle = snapshot.status === "idle";
  const isPaused = snapshot.status === "paused";

  async function handleStart() {
    setBusy(true);
    try {
      await start({ vehicleId: vehicleId || null, purpose });
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    setBusy(true);
    try {
      if (confirmAction === "stop") {
        await stop();
        toast(tn("tripSaved"));
      } else if (confirmAction === "discard") {
        await discard();
      }
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  }

  const gpsMessage =
    snapshot.gpsStatus === "permission_denied"
      ? te("locationDenied")
      : snapshot.gpsStatus === "unsupported"
        ? t("gpsStatus.unsupported")
        : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isIdle ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="tracking-purpose">{t("fields.purpose")}</Label>
                <NativeSelect
                  id="tracking-purpose"
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value as TripPurpose)}
                >
                  {PURPOSES.map((value) => (
                    <option key={value} value={value}>
                      {tp(value)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tracking-vehicle">{t("fields.vehicle")}</Label>
                <NativeSelect
                  id="tracking-vehicle"
                  value={vehicleId}
                  onChange={(event) => setVehicleId(event.target.value)}
                >
                  <option value="">{t("noVehicle")}</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.nickname}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>

            {gpsMessage ? (
              <Alert variant="destructive">
                <TriangleAlertIcon />
                <AlertDescription>{gpsMessage}</AlertDescription>
              </Alert>
            ) : null}

            <Button onClick={handleStart} disabled={busy} size="lg">
              <PlayIcon />
              {t("startTracking")}
            </Button>
          </>
        ) : (
          <>
            {justRecovered ? (
              <Alert variant="warning">
                <InfoIcon />
                <AlertDescription>{t("resumedAfterInterruption")}</AlertDescription>
              </Alert>
            ) : null}

            {!isOnline ? (
              <Alert variant="warning">
                <InfoIcon />
                <AlertDescription>{t("offlineNotice")}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">{t("inProgress")}</span>
              <StatusBadge tone={GPS_TONE[snapshot.gpsStatus]}>
                {t(`gpsStatus.${snapshot.gpsStatus}` as "gpsStatus.active")}
              </StatusBadge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">{t("currentDistance")}</span>
                <span className="text-metric text-3xl">
                  {formatMiles(snapshot.distanceMiles, locale, distanceUnitLabel)}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">{t("currentDuration")}</span>
                <span className="text-metric text-3xl">{formatDuration(snapshot.durationSeconds)}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {isPaused ? (
                <Button onClick={resume} disabled={busy}>
                  <PlayIcon />
                  {t("resume")}
                </Button>
              ) : (
                <Button onClick={pause} disabled={busy} variant="outline">
                  <PauseIcon />
                  {t("pause")}
                </Button>
              )}
              <Button onClick={() => setConfirmAction("stop")} disabled={busy}>
                <SquareIcon />
                {t("stopTracking")}
              </Button>
              <Button
                onClick={() => setConfirmAction("discard")}
                disabled={busy}
                variant="outline"
                className="text-destructive hover:text-destructive"
              >
                <Trash2Icon />
                {t("discardTrip")}
              </Button>
            </div>

            <Alert>
              <CarIcon />
              <AlertDescription>{t("webLimitationNotice")}</AlertDescription>
            </Alert>
          </>
        )}
      </CardContent>

      <Dialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "stop" ? t("endTripConfirm.title") : t("discardTripConfirm.title")}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "stop"
                ? t("endTripConfirm.description")
                : t("discardTripConfirm.description")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{tc("cancel")}</Button>
            </DialogClose>
            <Button
              onClick={handleConfirm}
              disabled={busy}
              variant={confirmAction === "discard" ? "destructive" : "default"}
            >
              {tc("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
