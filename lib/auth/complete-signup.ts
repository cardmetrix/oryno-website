import {
  isValidUsername,
  normalizeUsername,
} from "@/lib/auth/username";

export type ContinueProfile = {
  username?: string;
  fullName?: string;
  phone?: string;
  legalAccepted?: boolean;
};

type SignUpLike = {
  status: string | null;
  missingFields?: string[] | null;
  update: (params: Record<string, unknown>) => Promise<SignUpLike>;
};

function splitName(fullName?: string) {
  const trimmed = (fullName ?? "").trim();
  if (!trimmed) return { firstName: undefined, lastName: undefined };
  const [firstName, ...rest] = trimmed.split(/\s+/);
  return {
    firstName: firstName || undefined,
    lastName: rest.join(" ") || undefined,
  };
}

/** Apply any Clerk missing fields we can fill from the user profile. */
export async function applyMissingSignUpFields(
  signUp: SignUpLike,
  profile: ContinueProfile,
): Promise<SignUpLike> {
  const missing = new Set(signUp.missingFields ?? []);
  if (missing.size === 0 && signUp.status === "complete") {
    return signUp;
  }

  const { firstName, lastName } = splitName(profile.fullName);
  const username = profile.username
    ? normalizeUsername(profile.username)
    : undefined;

  const update: Record<string, unknown> = {};

  if (missing.has("username") && username && isValidUsername(username)) {
    update.username = username;
  }
  if (missing.has("first_name") && firstName) {
    update.firstName = firstName;
  }
  if (missing.has("last_name") && lastName) {
    update.lastName = lastName;
  }
  if (missing.has("legal_accepted") && profile.legalAccepted !== false) {
    update.legalAccepted = true;
  }
  if (missing.has("phone_number") && profile.phone?.trim()) {
    update.phoneNumber = profile.phone.trim();
  }

  if (Object.keys(update).length === 0) {
    return signUp;
  }

  return signUp.update(update);
}

export function usernameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "user";
  const base = normalizeUsername(local) || "user";
  const suffix = Math.random().toString(36).slice(2, 6);
  const combined = `${base}_${suffix}`.slice(0, 32);
  return isValidUsername(combined) ? combined : `user_${suffix}`;
}
