import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  login: vi.fn(async () => ({})),
  setSession: vi.fn(),
  releaseLatch: vi.fn(),
  setCurrentUser: vi.fn(),
  bootstrap: vi.fn(async () => undefined),
  stopSync: vi.fn(),
}));

vi.mock('@/api/auth', () => ({
  authApi: {
    login: mocks.login,
    getAdminUserInfo: vi.fn(),
    getLoginUser: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));
vi.mock('@/config/apiFlags', () => ({ AUTH_LOGIN_BYPASS: false, useRealAuth: () => true }));
vi.mock('@/services/auth/authAdapter', () => ({
  mapLoginResponse: () => ({
    token: 'token', authorization: '', room: '01', roomGroup: 'ANES',
    user: { displayName: '测试医生', loginName: 'doctor' },
  }),
  mapCurrentUser: vi.fn(),
}));
vi.mock('@/services/session/samisSession', () => ({
  clearSamisSession: vi.fn(),
  getSamisRoom: () => '01',
  getSamisRoomGroup: () => 'ANES',
  getSamisUserProfile: () => null,
  isSamisLoggedIn: () => true,
  setSamisSession: mocks.setSession,
}));
vi.mock('@/services/auth/authFailureCoordinator', () => ({
  releaseAuthFailureLatch: mocks.releaseLatch,
}));
vi.mock('@/stores/anesthesia', () => ({
  useAnesthesiaStore: () => ({
    setCurrentUserFromSession: mocks.setCurrentUser,
    bootstrapSamisAuthenticatedData: mocks.bootstrap,
  }),
}));
vi.mock('@/services/anesthesia/anesthesiaSyncService', () => ({
  stopAnesthesiaSyncService: mocks.stopSync,
}));

import { loginWithCredentials, logoutSamis } from '@/services/auth/authService';

describe('authService authenticated runtime lifecycle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('releases the failure latch after writing a new session', async () => {
    await loginWithCredentials('doctor', 'secret');
    expect(mocks.setSession).toHaveBeenCalledTimes(1);
    expect(mocks.releaseLatch).toHaveBeenCalledTimes(1);
    expect(mocks.setSession.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.releaseLatch.mock.invocationCallOrder[0]);
    expect(mocks.bootstrap).toHaveBeenCalledTimes(1);
  });

  it('stops the authenticated runtime on explicit logout', async () => {
    logoutSamis();
    await vi.waitFor(() => expect(mocks.stopSync).toHaveBeenCalledTimes(1));
  });
});
