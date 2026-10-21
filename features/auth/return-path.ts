export function getSafeReturnPath(value: string | null | undefined, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}

export function getReturnPathFromLocation(fallback: string) {
  if (typeof window === "undefined") return fallback;
  return getSafeReturnPath(new URLSearchParams(window.location.search).get("returnTo"), fallback);
}
