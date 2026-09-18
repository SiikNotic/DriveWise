import type { ExpenseCategory } from "@drivewise/shared";

export interface ExpenseActionState {
  error?: string;
  success?: boolean;
}

export const initialExpenseActionState: ExpenseActionState = {};

export const MAX_RECEIPT_BYTES = 8 * 1024 * 1024;

/** A receipt is a photo — never trust the file's extension alone (it's user-controlled); this also blocks uploading e.g. an SVG/HTML file that could execute script when the owner later opens their own signed receipt URL. */
const ALLOWED_RECEIPT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export function isAllowedReceiptType(mimeType: string): boolean {
  return ALLOWED_RECEIPT_MIME_TYPES.has(mimeType.toLowerCase());
}

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
