import { toSamisHeaderValue } from '@/services/session/samisHeaderValue';

const TOKEN_KEY = 'samis_token';
const AUTH_KEY = 'samis_authorization';
const ROOM_KEY = 'samis_room';
const ROOM_GROUP_KEY = 'samis_room_group';
const USER_KEY = 'samis_user_profile';

export interface SamisUserProfile {
  userId?: string;
  loginName?: string;
  displayName?: string;
  roleNames?: string[];
  /** Header / API context — use room code (e.g. 01, OR-01), not display name */
  defaultRoom?: string;
  defaultRoomGroup?: string;
  defaultRoomName?: string;
  defaultRoomGroupName?: string;
}
function read(key: string): string {
  if (typeof sessionStorage === 'undefined') return '';
  return sessionStorage.getItem(key) ?? '';
}

function write(key: string, value: string) {
  if (typeof sessionStorage === 'undefined') return;
  if (!value) sessionStorage.removeItem(key);
  else sessionStorage.setItem(key, value);
}

export function getSamisToken(): string {
  return read(TOKEN_KEY);
}

export function getSamisAuthorization(): string {
  return read(AUTH_KEY);
}

export function getSamisRoom(): string {
  return read(ROOM_KEY);
}

export function getSamisRoomGroup(): string {
  return read(ROOM_GROUP_KEY);
}

export function getSamisUserProfile(): SamisUserProfile | null {
  const raw = read(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SamisUserProfile;
  } catch {
    return null;
  }
}

export function setSamisSession(payload: {
  token?: string;
  authorization?: string;
  room?: string;
  roomGroup?: string;
  user?: SamisUserProfile | null;
}) {
  if (payload.token !== undefined) write(TOKEN_KEY, payload.token);
  if (payload.authorization !== undefined) write(AUTH_KEY, payload.authorization);
  if (payload.room !== undefined) write(ROOM_KEY, payload.room);
  if (payload.roomGroup !== undefined) write(ROOM_GROUP_KEY, payload.roomGroup);
  if (payload.user !== undefined) {
    write(USER_KEY, payload.user ? JSON.stringify(payload.user) : '');
  }
}

export function clearSamisSession() {
  [TOKEN_KEY, AUTH_KEY, ROOM_KEY, ROOM_GROUP_KEY, USER_KEY].forEach((key) => {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key);
  });
}

export function isSamisLoggedIn(): boolean {
  return Boolean(getSamisToken() || getSamisAuthorization());
}

export function buildSamisRequestHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  const token = getSamisToken();
  const authorization = getSamisAuthorization();
  const room = getSamisRoom();
  const roomGroup = getSamisRoomGroup();
  if (token && !headers.has('token')) headers.set('token', token);
  if (authorization && !headers.has('Authorization')) headers.set('Authorization', authorization);
  else if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  const safeRoom = room ? toSamisHeaderValue(room) : '';
  const safeRoomGroup = roomGroup ? toSamisHeaderValue(roomGroup) : '';
  if (safeRoom && !headers.has('room')) headers.set('room', safeRoom);
  if (safeRoomGroup && !headers.has('roomGroup')) headers.set('roomGroup', safeRoomGroup);
  return headers;
}
