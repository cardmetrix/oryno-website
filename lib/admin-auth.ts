/**
 * Admin auth public surface.
 * Cookie name is edge-safe; session helpers are server-only.
 */
export { ADMIN_SESSION_COOKIE } from "@/lib/admin/cookie";
export {
  assertAdminRole,
  createAdminSession,
  getAdminSession,
  isValidAdminPasscode,
  requireAdminApi,
  resolveAdminForClerk,
  revokeAdminSession,
  adminCookieOptions,
  writeAdminAudit,
  type AdminRecord,
  type AdminRole,
  type AdminSessionContext,
} from "@/lib/admin/auth";
