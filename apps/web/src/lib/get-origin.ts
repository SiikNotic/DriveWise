import { headers } from "next/headers";

/**
 * The site origin, derived from request headers rather than a hardcoded env
 * var — correct in local dev, preview deployments, and production alike
 * without per-environment configuration.
 */
export async function getOrigin() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return `${proto}://${host}`;
}
