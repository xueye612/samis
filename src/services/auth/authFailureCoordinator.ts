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

export function releaseAuthFailureLatch(): void {
  pending = null;
  latched = false;
}
