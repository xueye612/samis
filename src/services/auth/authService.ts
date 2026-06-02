import { authApi } from '@/api/auth';
import { AUTH_LOGIN_BYPASS, useRealAuth } from '@/config/apiFlags';
import type { LoginContextOverride } from '@/services/auth/authAdapter';
import { mapCurrentUser, mapLoginResponse } from '@/services/auth/authAdapter';
import {
  clearSamisSession,
  getSamisRoom,
  getSamisRoomGroup,
  getSamisUserProfile,
  isSamisLoggedIn,
  setSamisSession,
  type SamisUserProfile,
} from '@/services/session/samisSession';

async function syncStoreCurrentUser(profile: SamisUserProfile | null | undefined) {
  if (!profile?.displayName) return;
  const { useAnesthesiaStore } = await import('@/stores/anesthesia');
  useAnesthesiaStore().setCurrentUserFromSession(profile);
}

export async function loginWithCredentials(
  username: string,
  password: string,
  context?: LoginContextOverride,
): Promise<SamisUserProfile> {
  const raw = await authApi.login({ username, password });
  const mapped = mapLoginResponse(raw, context);
  if (!mapped.token && !mapped.authorization) {
    throw new Error('登录成功但未返回 token');
  }
  const room = mapped.room || context?.room || '01';
  const roomGroup = mapped.roomGroup || context?.roomGroup || mapped.user.defaultRoomGroup || 'ANES';
  setSamisSession({
    token: mapped.token,
    authorization: mapped.authorization,
    room,
    roomGroup,
    user: { ...mapped.user, defaultRoom: room, defaultRoomGroup: roomGroup },
  });
  await syncStoreCurrentUser(mapped.user);
  return mapped.user;
}

export async function fetchCurrentUser(): Promise<SamisUserProfile | null> {
  if (!isSamisLoggedIn() && !AUTH_LOGIN_BYPASS) return null;
  if (!useRealAuth()) {
    const profile = getSamisUserProfile();
    await syncStoreCurrentUser(profile);
    return profile;
  }
  try {
    const raw = await authApi.getAdminUserInfo()
      .catch(() => authApi.getLoginUser())
      .catch(() => authApi.getCurrentUser());
    const user = mapCurrentUser(raw);
    const profile = getSamisUserProfile();
    const room = user.defaultRoom ?? profile?.defaultRoom ?? getSamisRoom();
    const roomGroup = user.defaultRoomGroup ?? profile?.defaultRoomGroup ?? getSamisRoomGroup();
    setSamisSession({
      user: { ...profile, ...user, defaultRoom: room, defaultRoomGroup: roomGroup },
      room,
      roomGroup,
    });
    await syncStoreCurrentUser(user);
    return user;
  } catch {
    const profile = getSamisUserProfile();
    await syncStoreCurrentUser(profile);
    return profile;
  }
}

export async function restoreSessionIfPresent(): Promise<void> {
  if (!isSamisLoggedIn()) return;
  await fetchCurrentUser();
}

export function logoutSamis() {
  clearSamisSession();
}

export function checkSamisAuthRequired(): boolean {
  if (AUTH_LOGIN_BYPASS) return false;
  return useRealAuth();
}

export function ensureLoggedIn(): boolean {
  if (!checkSamisAuthRequired()) return true;
  return isSamisLoggedIn();
}
