import {
  resolveCountryCode,
  type SupportedCountryCode,
} from "@/lib/country";

/** Force a market for specific usernames (test / partner accounts). */
const USERNAME_COUNTRY: Record<string, SupportedCountryCode> = {
  ziecozeno4: "GH",
};

export function countryOverrideForUsername(
  username?: string | null,
): SupportedCountryCode | null {
  if (!username) return null;
  const mapped = USERNAME_COUNTRY[username.trim().toLowerCase()];
  return mapped ? resolveCountryCode(mapped) : null;
}
