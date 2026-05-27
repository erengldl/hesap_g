import { AsyncLocalStorage } from "node:async_hooks";

export type RequestContext = {
  userId: number;
  authUserId: string | null;
  email: string;
  name: string;
  plan: string;
  requestId: string;
};

const requestContextStore = new AsyncLocalStorage<RequestContext | null>();

export function setRequestContext(context: RequestContext) {
  requestContextStore.enterWith(context);
}

export function clearRequestContext() {
  requestContextStore.enterWith(null);
}

export function getRequestContext() {
  return requestContextStore.getStore() ?? null;
}

export function getRequiredRequestContext() {
  const context = getRequestContext();
  if (!context) {
    throw new Error("Authenticated request context is missing.");
  }
  return context;
}
