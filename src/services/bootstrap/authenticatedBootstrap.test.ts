import { describe, expect, it, vi } from 'vitest';
import { runAuthenticatedBootstrap } from '@/services/bootstrap/authenticatedBootstrap';

describe('authenticatedBootstrap', () => {
  it('does not load protected catalogs without a session', async () => {
    const load = vi.fn();
    await expect(runAuthenticatedBootstrap({ isLoggedIn: () => false, load })).resolves.toBe('skipped');
    expect(load).not.toHaveBeenCalled();
  });

  it('coalesces concurrent authenticated bootstrap calls', async () => {
    const load = vi.fn(async () => undefined);
    await Promise.all([
      runAuthenticatedBootstrap({ isLoggedIn: () => true, load }),
      runAuthenticatedBootstrap({ isLoggedIn: () => true, load }),
    ]);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
