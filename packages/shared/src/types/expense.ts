export type ExpenseCategory =
  | "fuel"
  | "maintenance"
  | "repairs"
  | "insurance"
  | "tolls"
  | "parking"
  | "car_wash"
  | "other";

const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  "fuel",
  "maintenance",
  "repairs",
  "insurance",
  "tolls",
  "parking",
  "car_wash",
  "other",
];

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

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
