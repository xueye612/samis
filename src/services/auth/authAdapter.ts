import type { SamisUserProfile } from '@/services/session/samisSession';

function pickString(raw: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return undefined;
}

export function unwrapAuthPayload(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  const record = raw as Record<string, unknown>;
  const nested = record.data;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return record;
}

/** Apifox SAMIS-PC: POST /admin/login (application/x-www-form-urlencoded) */
export function buildAdminLoginFormBody(username: string, password: string): Record<string, string> {
  return {
    username: username.trim(),
    password,
  };
}

/** @deprecated JSON multi-field body; real backend uses buildAdminLoginFormBody */
export function buildLoginRequestBody(username: string, password: string): Record<string, string> {
  const login = username.trim();
  return {
    username: login,
    loginName: login,
    login_name: login,
    password,
    pwd: password,
  };
}

/** Merge `data.userInfo` with `data` for field picking (admin/login response). */
export function authPayloadSources(raw: unknown): Record<string, unknown> {
  const payload = unwrapAuthPayload(raw);
  const userInfo = payload.userInfo;
  if (userInfo && typeof userInfo === 'object' && !Array.isArray(userInfo)) {
    return { ...(userInfo as Record<string, unknown>), ...payload };
  }
  return payload;
}

export interface LoginContextOverride {
  room?: string;
  roomGroup?: string;
}

export function mapLoginResponse(
  raw: unknown,
  override?: LoginContextOverride,
): {
  token: string;
  authorization: string;
  room: string;
  roomGroup: string;
  user: SamisUserProfile;
} {
  const payload = authPayloadSources(raw);
  const token = pickString(payload, ['token', 'accessToken', 'access_token']) ?? '';
  const authorization = pickString(payload, ['authorization', 'Authorization']) ?? (token ? `Bearer ${token}` : '');
  const displayName = pickString(payload, ['userName', 'user_name', 'name', 'nickName', 'nick_name']) ?? '用户';
  const loginName = pickString(payload, ['GH', 'NumGh', 'gh', 'loginName', 'login_name', 'username']) ?? displayName;
  const apiRoomCode = pickString(payload, ['room_id', 'roomId', 'roomCode', 'ROOMID', 'defaultRoom', 'room']);
  const apiRoomName = pickString(payload, ['roomName', 'ROOMNAME', 'room_name']);
  const apiRoomGroupCode = pickString(payload, [
    'room_group_id',
    'roomGroupId',
    'room_group',
    'roomGroup',
    'defaultRoomGroup',
    'deptCode',
    'department_code',
  ]);
  const apiRoomGroupName = pickString(payload, ['roomGroupName', 'deptName', 'department_name']);
  const room = apiRoomCode || override?.room || '';
  const roomGroup = apiRoomGroupCode || override?.roomGroup || '';
  return {
    token,
    authorization,
    room,
    roomGroup,
    user: {
      userId: pickString(payload, ['userId', 'user_id', 'id']) ?? pickString(payload, ['GH', 'NumGh']),
      loginName,
      displayName,
      defaultRoom: room,
      defaultRoomGroup: roomGroup,
      defaultRoomName: apiRoomName,
      defaultRoomGroupName: apiRoomGroupName,
      roleNames: Array.isArray(payload.roleNames)
        ? (payload.roleNames as string[])
        : Array.isArray(payload.roles)
          ? (payload.roles as string[])
          : undefined,
    },
  };
}

export function mapCurrentUser(raw: unknown): SamisUserProfile {
  const payload = unwrapAuthPayload(raw);
  const displayName = pickString(payload, ['userName', 'user_name', 'name', 'displayName', 'nickName']) ?? '用户';
  return {
    userId: pickString(payload, ['userId', 'user_id', 'id']),
    loginName: pickString(payload, ['loginName', 'login_name', 'username', 'gh']),
    displayName,
    defaultRoom: pickString(payload, ['room_id', 'roomId', 'roomCode', 'room', 'defaultRoom', 'ROOMID']),
    defaultRoomGroup: pickString(payload, [
      'room_group_id',
      'roomGroupId',
      'room_group',
      'roomGroup',
      'defaultRoomGroup',
      'deptCode',
    ]),
    defaultRoomName: pickString(payload, ['roomName', 'ROOMNAME', 'room_name']),
    defaultRoomGroupName: pickString(payload, ['roomGroupName', 'department_name', 'deptName']),
    roleNames: Array.isArray(payload.roleNames) ? (payload.roleNames as string[]) : undefined,
  };
}

export function formatAuthError(error: unknown): string {
  if (error && typeof error === 'object' && 'name' in error && (error as { name: string }).name === 'SamisHttpError') {
    const httpErr = error as unknown as { message: string; isAuthError?: boolean; isNetworkError?: boolean };
    if (httpErr.isAuthError) return httpErr.message || '账号或密码错误';
    if (httpErr.isNetworkError) return httpErr.message || '网络连接失败，请检查网络或代理';
    return httpErr.message || '登录失败';
  }
  if (error instanceof Error) return error.message;
  return '登录失败';
}
