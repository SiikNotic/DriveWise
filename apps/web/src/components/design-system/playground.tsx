"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

const BUTTON_VARIANTS = [
  "default",
  "secondary",
  "outline",
  "ghost",
  "link",
  "destructive",
] as const;

export function ButtonPlayground() {
  const t = useTranslations("designSystem.playground.buttonSizes");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        {BUTTON_VARIANTS.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm">{t("small")}</Button>
        <Button size="default">{t("default")}</Button>
        <Button size="lg">{t("large")}</Button>
        <Button disabled>{t("disabled")}</Button>
      </div>
    </div>
  );
}

export function InputPlayground() {
  const t = useTranslations("designSystem.playground.inputs");
  const tc = useTranslations("common");

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <Label htmlFor="ds-vehicle">{t("vehicleNicknameLabel")}</Label>
        <Input id="ds-vehicle" placeholder={t("vehicleNicknamePlaceholder")} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ds-platform">{t("platformLabel")}</Label>
        <Select defaultValue="doordash">
          <SelectTrigger id="ds-platform" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="doordash">DoorDash</SelectItem>
            <SelectItem value="uber_eats">Uber Eats</SelectItem>
            <SelectItem value="grubhub">Grubhub</SelectItem>
            <SelectItem value="instacart">Instacart</SelectItem>
            <SelectItem value="other">{tc("other")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ds-disabled">{t("disabledLabel")}</Label>
        <Input id="ds-disabled" placeholder={t("disabledPlaceholder")} disabled />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ds-invalid">{t("invalidLabel")}</Label>
        <Input id="ds-invalid" aria-invalid defaultValue={t("invalidValue")} />
      </div>
    </div>
  );
}

export function TabsPlayground() {
  const t = useTranslations("designSystem.playground.tabs");

  return (
    <Tabs defaultValue="week">
      <TabsList>
        <TabsTrigger value="week">{t("week")}</TabsTrigger>
        <TabsTrigger value="month">{t("month")}</TabsTrigger>
        <TabsTrigger value="year">{t("year")}</TabsTrigger>
      </TabsList>
      <TabsContent value="week" className="text-muted-foreground text-sm">
        {t("weekContent")}
      </TabsContent>
      <TabsContent value="month" className="text-muted-foreground text-sm">
        {t("monthContent")}
      </TabsContent>
      <TabsContent value="year" className="text-muted-foreground text-sm">
        {t("yearContent")}
      </TabsContent>
    </Tabs>
  );
}

export function OverlayPlayground() {
  const t = useTranslations("designSystem");
  const tc = useTranslations("common");
  const tt = useTranslations("trips");
  const tn = useTranslations("notifications");

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="outline"
        onClick={() =>
          toast(tn("tripSynced"), {
            description: tn("syncComplete"),
          })
        }
      >
        {t("toastDemo")}
      </Button>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="destructive">{t("dialogTrigger")}</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tt("deleteConfirm.title")}</DialogTitle>
            <DialogDescription>{tt("deleteConfirm.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{tc("cancel")}</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button variant="destructive">{tc("delete")}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
