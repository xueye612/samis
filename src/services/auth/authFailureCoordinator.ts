export interface AuthFailureActions {
  clearSession(): void;
  stopRuntime(): void | Promise<void>;
  notify(message: string): void | Promise<void>;
  redirect(): void | Promise<void>;
}

let pending: Promise<void> | null = null;
let latched = false;

export function coordinateAuthFailure(message: string, actions: AuthFailureActions): Promise<void> {
  if (pending) return pending;
  if (latched) return Promise.resolve();
  latched = true;
  actions.clearSession();
  pending = (async () => {
    try { await actions.stopRuntime(); } catch { /* redirect must still happen */ }
    try { await actions.notify(message || '登录已失效，请重新登录'); } catch { /* ignore UI failure */ }
    try { await actions.redirect(); } catch { /* keep the original HTTP error */ }
  })()
    .finally(() => { pending = null; });
  return pending;
}

/**
 * Silently latch before a voluntary logout so in-flight 9001/9003 responses
 * arriving after the session is cleared do not trigger clear/stop/notify/redirect.
 * Stays latched until a successful login calls releaseAuthFailureLatch().
 */
export function latchAuthFailuresUntilLogin(): void {
  pending = null;
  latched = true;
}

export function releaseAuthFailureLatch(): void {
  pending = null;
  latched = false;
}
