import { samisRequest } from '@/api/samisClient';
import { buildFormPost } from '@/api/samisFormBody';
import { buildAdminLoginFormBody } from '@/services/auth/authAdapter';

export interface LoginRequest {
  username: string;
  password: string;
}

export const authApi = {
  /** SAMIS-PC: POST /admin/login (Apifox); not /login/login */
  login(body: LoginRequest) {
    return samisRequest<Record<string, unknown>>(
      '/admin/login',
      buildFormPost(buildAdminLoginFormBody(body.username, body.password)),
      { module: 'auth' },
    );
  },
  getLoginUser() {
    return samisRequest<Record<string, unknown>>('/user/getLoginUser', undefined, { module: 'auth' });
  },
  getCurrentUser() {
    return samisRequest<Record<string, unknown>>('/user/getCurrentUser', undefined, { module: 'auth' });
  },
  getAdminUserInfo() {
    return samisRequest<Record<string, unknown>>('/adminUser/getAdminUserInfo', undefined, { module: 'auth' });
  },

  // ---- 权限管理 ----
  myPermissions() {
    return samisRequest<{ permissions: string[]; role: string; groupid: number | null }>(
      '/auth/myPermissions', undefined, { module: 'auth' },
    );
  },
  permissionList() {
    return samisRequest<{ list: Array<{ permissionCode: string; permissionName: string; module: string; action: string; isActive: boolean }> }>(
      '/auth/permissionList', undefined, { module: 'auth' },
    );
  },
  groupPermissions(groupId: number) {
    return samisRequest<{ list: Array<{ permissionCode: string; permissionName: string | null }> }>(
      `/auth/groupPermissions?groupId=${encodeURIComponent(String(groupId))}`, undefined, { module: 'auth' },
    );
  },
  bindPermission(groupId: number, permissionCode: string) {
    return samisRequest<null>('/auth/bindPermission', buildFormPost({ groupId, permissionCode }), { module: 'auth' });
  },
  unbindPermission(groupId: number, permissionCode: string) {
    return samisRequest<null>('/auth/unbindPermission', buildFormPost({ groupId, permissionCode }), { module: 'auth' });
  },

  // ---- 审计查询 ----
  auditByOperation(operationId: string, page = 1, pageSize = 20) {
    return samisRequest<{ list: unknown[]; total: number; page: number; pageSize: number }>(
      `/auth/auditByOperation?operationId=${encodeURIComponent(operationId)}&page=${page}&page_size=${pageSize}`,
      undefined, { module: 'auth' },
    );
  },
  auditByModule(module: string, action = '', page = 1, pageSize = 20) {
    const q = `module=${encodeURIComponent(module)}${action ? `&action=${encodeURIComponent(action)}` : ''}&page=${page}&page_size=${pageSize}`;
    return samisRequest<{ list: unknown[]; total: number }>(
      `/auth/auditByModule?${q}`, undefined, { module: 'auth' },
    );
  },
};
