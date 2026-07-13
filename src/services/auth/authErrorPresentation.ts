import { SamisHttpError } from '@/api/samisHttpClient';

export function notifyIfUnhandledSamisError(
  error: unknown,
  notify: () => void,
): void {
  if (error instanceof SamisHttpError && error.isAuthError) return;
  notify();
}
