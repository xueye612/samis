export interface AuthenticatedBootstrapOptions {
  isLoggedIn(): boolean;
  load(): Promise<void>;
}

let pending: Promise<void> | null = null;

export async function runAuthenticatedBootstrap(
  options: AuthenticatedBootstrapOptions,
): Promise<'skipped' | 'completed'> {
  if (!options.isLoggedIn()) return 'skipped';
  pending ??= options.load().finally(() => { pending = null; });
  await pending;
  return 'completed';
}
