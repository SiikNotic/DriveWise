export type ExpenseCategory =
  | "fuel"
  | "maintenance"
  | "insurance"
  | "vehicle_payment"
  | "phone_plan"
  | "supplies"
  | "parking_tolls"
  | "other";

export interface Expense {
  id: string;
  userId: string;
  clientId: string;
  vehicleId: string | null;
  category: ExpenseCategory;
  amountUsd: number;
  incurredOn: string;
  description: string | null;
  receiptStoragePath: string | null;
  isTaxDeductible: boolean;
  createdAt: string;
  updatedAt: string;
}
