import type { ExpenseCategory } from "@drivewise/shared";

export interface ExpenseActionState {
  error?: string;
  success?: boolean;
}

export const initialExpenseActionState: ExpenseActionState = {};

export const MAX_RECEIPT_BYTES = 8 * 1024 * 1024;

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "fuel",
  "maintenance",
  "repairs",
  "insurance",
  "tolls",
  "parking",
  "car_wash",
  "other",
];
