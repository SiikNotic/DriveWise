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
        <Button size="sm">Small</Button>
        <Button size="default">Default</Button>
        <Button size="lg">Large</Button>
        <Button disabled>Disabled</Button>
      </div>
    </div>
  );
}

export function InputPlayground() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <Label htmlFor="ds-vehicle">Vehicle nickname</Label>
        <Input id="ds-vehicle" placeholder="My Civic" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ds-platform">Platform</Label>
        <Select defaultValue="doordash">
          <SelectTrigger id="ds-platform" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="doordash">DoorDash</SelectItem>
            <SelectItem value="uber_eats">Uber Eats</SelectItem>
            <SelectItem value="grubhub">Grubhub</SelectItem>
            <SelectItem value="instacart">Instacart</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ds-disabled">Disabled</Label>
        <Input id="ds-disabled" placeholder="Not editable" disabled />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ds-invalid">Invalid</Label>
        <Input id="ds-invalid" aria-invalid defaultValue="not a number" />
      </div>
    </div>
  );
}

export function TabsPlayground() {
  return (
    <Tabs defaultValue="week">
      <TabsList>
        <TabsTrigger value="week">This week</TabsTrigger>
        <TabsTrigger value="month">This month</TabsTrigger>
        <TabsTrigger value="year">This year</TabsTrigger>
      </TabsList>
      <TabsContent value="week" className="text-muted-foreground text-sm">
        Showing metrics for the current week.
      </TabsContent>
      <TabsContent value="month" className="text-muted-foreground text-sm">
        Showing metrics for the current month.
      </TabsContent>
      <TabsContent value="year" className="text-muted-foreground text-sm">
        Showing metrics for the current year.
      </TabsContent>
    </Tabs>
  );
}

export function OverlayPlayground() {
  const t = useTranslations("designSystem");

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="outline"
        onClick={() =>
          toast(t("toastDemo"), {
            description: "Trip synced to your account.",
          })
        }
      >
        {t("toastDemo")}
      </Button>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="destructive">{t("dialogDemo.trigger")}</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialogDemo.title")}</DialogTitle>
            <DialogDescription>{t("dialogDemo.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("dialogDemo.cancel")}</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button variant="destructive">{t("dialogDemo.confirm")}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
