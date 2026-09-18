"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { calculateVehicleOperatingCost } from "@drivewise/shared";

import {
  createVehicleAction,
  updateVehicleAction,
} from "@/lib/vehicles/actions";
import { initialVehicleActionState } from "@/lib/vehicles/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormError } from "@/components/forms/form-error";
import { CostBreakdown } from "@/components/vehicles/cost-breakdown";

export interface VehicleFormValues {
  nickname: string;
  make: string;
  model: string;
  year: string;
  trim: string;
  fuelType: string;
  fuelEfficiencyMpg: string;
  fuelPriceUsd: string;
  insuranceMonthlyCostUsd: string;
  maintenanceCostPerMileUsd: string;
  depreciationCostPerMileUsd: string;
  otherOperatingCostPerMileUsd: string;
  estimatedMonthlyMiles: string;
}

const DEFAULT_VALUES: VehicleFormValues = {
  nickname: "",
  make: "",
  model: "",
  year: "",
  trim: "",
  fuelType: "gasoline",
  fuelEfficiencyMpg: "",
  fuelPriceUsd: "",
  insuranceMonthlyCostUsd: "",
  maintenanceCostPerMileUsd: "",
  depreciationCostPerMileUsd: "",
  otherOperatingCostPerMileUsd: "",
  estimatedMonthlyMiles: "1000",
};

/** Same numeric fallback the server action uses, so the live preview matches what gets saved. */
function toNumber(value: string, fallback: number): number {
  if (value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function VehicleForm({
  mode,
  vehicleId,
  defaultValues,
}: {
  mode: "create" | "edit";
  vehicleId?: string;
  defaultValues?: Partial<VehicleFormValues>;
}) {
  const t = useTranslations("vehicles");
  const tf = useTranslations("vehicles.fields");
  const tc = useTranslations("common");
  const tu = useTranslations("units");
  const locale = useLocale();

  const values = { ...DEFAULT_VALUES, ...defaultValues };
  const action = mode === "create" ? createVehicleAction : updateVehicleAction;
  const [state, formAction] = useActionState(action, initialVehicleActionState);

  // Only the cost-affecting fields need to be controlled — the rest can stay
  // uncontrolled (defaultValue) since they don't feed the live preview below.
  const [costInputs, setCostInputs] = useState({
    fuelEfficiencyMpg: values.fuelEfficiencyMpg,
    fuelPriceUsd: values.fuelPriceUsd,
    insuranceMonthlyCostUsd: values.insuranceMonthlyCostUsd,
    maintenanceCostPerMileUsd: values.maintenanceCostPerMileUsd,
    depreciationCostPerMileUsd: values.depreciationCostPerMileUsd,
    otherOperatingCostPerMileUsd: values.otherOperatingCostPerMileUsd,
    estimatedMonthlyMiles: values.estimatedMonthlyMiles,
  });

  const breakdown = calculateVehicleOperatingCost({
    fuelEfficiencyMpg: toNumber(costInputs.fuelEfficiencyMpg, 0),
    fuelPriceUsd: toNumber(costInputs.fuelPriceUsd, 0),
    insuranceMonthlyCostUsd: toNumber(costInputs.insuranceMonthlyCostUsd, 0),
    maintenanceCostPerMileUsd: toNumber(costInputs.maintenanceCostPerMileUsd, 0),
    depreciationCostPerMileUsd: toNumber(costInputs.depreciationCostPerMileUsd, 0),
    otherOperatingCostPerMileUsd: toNumber(costInputs.otherOperatingCostPerMileUsd, 0),
    estimatedMonthlyMiles: toNumber(costInputs.estimatedMonthlyMiles, 1000),
  });

  function updateCostInput(key: keyof typeof costInputs) {
    return (event: React.ChangeEvent<HTMLInputElement>) =>
      setCostInputs((prev) => ({ ...prev, [key]: event.target.value }));
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <FormError message={state?.error} />

      {mode === "edit" && vehicleId ? (
        <input type="hidden" name="id" value={vehicleId} />
      ) : null}

      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold">{t("vehicleInfo")}</h2>

        <div className="grid gap-1.5">
          <Label htmlFor="nickname">{tf("nickname")}</Label>
          <Input
            id="nickname"
            name="nickname"
            defaultValue={values.nickname}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="make">{tf("make")}</Label>
            <Input id="make" name="make" defaultValue={values.make} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="model">{tf("model")}</Label>
            <Input id="model" name="model" defaultValue={values.model} required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="year">{tf("year")}</Label>
            <Input
              id="year"
              name="year"
              type="number"
              inputMode="numeric"
              min={1980}
              max={2100}
              defaultValue={values.year}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="trim">
              {tf("trim")} <span className="text-muted-foreground">({tc("optional")})</span>
            </Label>
            <Input id="trim" name="trim" defaultValue={values.trim} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="fuelType">{tf("fuelType")}</Label>
            <NativeSelect id="fuelType" name="fuelType" defaultValue={values.fuelType}>
              <option value="gasoline">{t("fuelType.gasoline")}</option>
              <option value="diesel">{t("fuelType.diesel")}</option>
              <option value="hybrid">{t("fuelType.hybrid")}</option>
              <option value="electric">{t("fuelType.electric")}</option>
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fuelEfficiencyMpg">{tf("fuelEfficiency")}</Label>
            <Input
              id="fuelEfficiencyMpg"
              name="fuelEfficiencyMpg"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0.1"
              value={costInputs.fuelEfficiencyMpg}
              onChange={updateCostInput("fuelEfficiencyMpg")}
              required
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t pt-4">
        <div>
          <h2 className="text-sm font-semibold">{t("operatingCosts")}</h2>
          <p className="text-muted-foreground text-xs">{t("operatingCostsHint")}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="fuelPriceUsd">{tf("fuelPrice")}</Label>
            <Input
              id="fuelPriceUsd"
              name="fuelPriceUsd"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={costInputs.fuelPriceUsd}
              onChange={updateCostInput("fuelPriceUsd")}
            />
            <p className="text-muted-foreground text-xs">
              {t("fieldHints.fuelPrice")}
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="insuranceMonthlyCostUsd">{tf("insuranceMonthlyCost")}</Label>
            <Input
              id="insuranceMonthlyCostUsd"
              name="insuranceMonthlyCostUsd"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={costInputs.insuranceMonthlyCostUsd}
              onChange={updateCostInput("insuranceMonthlyCostUsd")}
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="estimatedMonthlyMiles">{tf("estimatedMonthlyMiles")}</Label>
          <Input
            id="estimatedMonthlyMiles"
            name="estimatedMonthlyMiles"
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            value={costInputs.estimatedMonthlyMiles}
            onChange={updateCostInput("estimatedMonthlyMiles")}
          />
          <p className="text-muted-foreground text-xs">
            {t("fieldHints.estimatedMonthlyMiles")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="maintenanceCostPerMileUsd">
              {tf("maintenanceCostPerMile")}
            </Label>
            <Input
              id="maintenanceCostPerMileUsd"
              name="maintenanceCostPerMileUsd"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={costInputs.maintenanceCostPerMileUsd}
              onChange={updateCostInput("maintenanceCostPerMileUsd")}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="depreciationCostPerMileUsd">
              {tf("depreciationCostPerMile")}
            </Label>
            <Input
              id="depreciationCostPerMileUsd"
              name="depreciationCostPerMileUsd"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={costInputs.depreciationCostPerMileUsd}
              onChange={updateCostInput("depreciationCostPerMileUsd")}
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="otherOperatingCostPerMileUsd">
            {tf("otherOperatingCostPerMile")}
          </Label>
          <Input
            id="otherOperatingCostPerMileUsd"
            name="otherOperatingCostPerMileUsd"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={costInputs.otherOperatingCostPerMileUsd}
            onChange={updateCostInput("otherOperatingCostPerMileUsd")}
          />
        </div>

        <CostBreakdown breakdown={breakdown} locale={locale} distanceUnitLabel={tu("mi")} />
      </div>

      <SubmitButton pendingChildren={tc("save")}>{tc("save")}</SubmitButton>
    </form>
  );
}
