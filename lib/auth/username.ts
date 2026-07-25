/** Clerk-friendly username: lowercase letters, numbers, underscores. */
export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32);
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9_]{3,32}$/.test(username);
}
