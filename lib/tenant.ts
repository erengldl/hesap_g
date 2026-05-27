import { getRequestContext } from "@/lib/request-context";

export function getCurrentAuthUserId() {
  return getRequestContext()?.authUserId ?? null;
}

export function requireCurrentAuthUserId() {
  const authUserId = getCurrentAuthUserId();
  if (!authUserId) {
    throw new Error("Authenticated tenant context is missing.");
  }
  return authUserId;
}

export function buildScopedWhere(column: string) {
  return `${column} = ?`;
}

export function appendTenantParam(params: unknown[] = []) {
  return [...params, requireCurrentAuthUserId()];
}
