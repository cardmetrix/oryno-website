export const ADMIN_SESSION_COOKIE = "oryno_admin_session";
export const ADMIN_PASSCODE = "246810";

export function isValidAdminPasscode(code: string) {
  return code.replace(/\s/g, "") === ADMIN_PASSCODE;
}
