import {
  resolveCountryCode,
  type SupportedCountryCode,
} from "@/lib/country";

/** Force a market for specific accounts. Google / IP location cannot override these. */
const USERNAME_COUNTRY: Record<string, SupportedCountryCode> = {
  ziecozeno4: "ZA",
};

const EMAIL_COUNTRY: Record<string, SupportedCountryCode> = {
  "ziecozeno2@gmail.com": "KE",
};

export function countryOverrideForUser(input: {
  username?: string | null;
  email?: string | null;
}): SupportedCountryCode | null {
  const username = input.username?.trim().toLowerCase();
  if (username && USERNAME_COUNTRY[username]) {
    return resolveCountryCode(USERNAME_COUNTRY[username]);
  }

  const email = input.email?.trim().toLowerCase();
  if (email && EMAIL_COUNTRY[email]) {
    return resolveCountryCode(EMAIL_COUNTRY[email]);
  }

  return null;
}

/** @deprecated use countryOverrideForUser */
export function countryOverrideForUsername(
  username?: string | null,
  email?: string | null,
): SupportedCountryCode | null {
  return countryOverrideForUser({ username, email });
}
