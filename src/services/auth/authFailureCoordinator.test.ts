import { beforeEach, describe, expect, it, vi } from 'vitest';
import { coordinateAuthFailure, releaseAuthFailureLatch } from '@/services/auth/authFailureCoordinator';

describe('authFailureCoordinator', () => {
  beforeEach(releaseAuthFailureLatch);

  const actions = () => ({
    clearSession: vi.fn(),
    stopRuntime: vi.fn(async () => undefined),
    notify: vi.fn(async () => undefined),
    redirect: vi.fn(async () => undefined),
  });

  it('clears, stops, notifies and redirects once for concurrent failures', async () => {
    const actionSet = actions();
    await Promise.all(Array.from({ length: 8 }, () => coordinateAuthFailure('Token缺失', actionSet)));
    expect(actionSet.clearSession).toHaveBeenCalledTimes(1);
    expect(actionSet.stopRuntime).toHaveBeenCalledTimes(1);
    expect(actionSet.notify).toHaveBeenCalledTimes(1);
    expect(actionSet.redirect).toHaveBeenCalledTimes(1);
  });

  it('keeps late responses latched until a successful login releases it', async () => {
    const actionSet = actions();
    await coordinateAuthFailure('Token失效', actionSet);
    await coordinateAuthFailure('迟到响应', actionSet);
    expect(actionSet.notify).toHaveBeenCalledTimes(1);
    releaseAuthFailureLatch();
    await coordinateAuthFailure('新会话失效', actionSet);
    expect(actionSet.notify).toHaveBeenCalledTimes(2);
  });

  it('still redirects when stopping the background runtime fails', async () => {
    const actionSet = actions();
    actionSet.stopRuntime.mockRejectedValueOnce(new Error('stop failed'));
    await coordinateAuthFailure('Token缺失', actionSet);
    expect(actionSet.notify).toHaveBeenCalledTimes(1);
    expect(actionSet.redirect).toHaveBeenCalledTimes(1);
  });
});
