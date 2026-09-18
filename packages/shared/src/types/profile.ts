export interface Profile {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  /** ISO-ish country code, e.g. "US" — see constants/regions. */
  country: string | null;
  /** US state/territory code, e.g. "PR" — only meaningful when country is "US". */
  state: string | null;
  createdAt: string;
  updatedAt: string;
}
