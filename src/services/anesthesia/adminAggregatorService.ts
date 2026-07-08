import { Message } from '@arco-design/web-vue';
import {
  adminUserApi,
  type AdminUserApi,
  type AdminUserCreatePayload,
  type AdminUserGroupApi,
  type AdminUserListQuery,
  type AdminUserUpdatePayload,
  type AdminMenuNodeApi,
} from '@/api/adminUser';
import { useRealAdmin } from '@/config/apiFlags';
import { SamisHttpError } from '@/api/samisHttpClient';
import { isSamisLoggedIn } from '@/services/session/samisSession';
import type { SystemUser } from '@/types/system';

function describeError(error: unknown, fallback: string): string {
  if (error instanceof SamisHttpError) return error.message;
  return error instanceof Error ? error.message : fallback;
}

function shouldUseReal(): boolean {
  return useRealAdmin() && isSamisLoggedIn();
}

/** 后端 user_information 行 → 前端 SystemUser（groupid 作 role，is_del 反演 active）。 */
function apiUserToSystemUser(row: AdminUserApi): SystemUser {
  const groupid = typeof row.groupid === 'number' ? row.groupid : Number(row.groupid) || 0;
  return {
    id: String(row.id ?? ''),
    username: String(row.GH ?? row.NumGh ?? ''),
    name: String(row.name ?? ''),
    role: groupid,
    department: String(row.department_name ?? row.department_code ?? ''),
    active: Number(row.is_del ?? 0) === 0,
  };
}

/** 前端 SystemUser → 后端 createUser 入参。 */
function toCreatePayload(input: AdminUserInput): AdminUserCreatePayload {
  return {
    name: input.name,
    gh: input.username,
    password: input.password ?? '',
    groupid: typeof input.role === 'number' ? input.role : Number(input.role) || 0,
    department_name: input.department || undefined,
  };
}

/** 前端 SystemUser → 后端 updateUser 入参。 */
function toUpdatePayload(input: AdminUserInput): AdminUserUpdatePayload {
  const payload: AdminUserUpdatePayload = {
    id: input.id ?? '',
    name: input.name,
    gh: input.username,
    groupid: typeof input.role === 'number' ? input.role : Number(input.role) || 0,
    department_name: input.department || undefined,
  };
  if (input.password) payload.password = input.password;
  return payload;
}

export interface AdminUserInput {
  id?: string | number;
  username: string;
  name: string;
  /** 真实模式=角色组 groupid(number)；mock 模式=本地枚举(string) */
  role: number | string;
  department: string;
  /** create 必填；update 可选（重置密码） */
  password?: string;
}

/** 用户列表（真实开关开→远程；关/未登录→空 + source='mock'，视图回退本地 seed）。 */
export async function loadAdminUsers(params: AdminUserListQuery = {}): Promise<{
  list: SystemUser[];
  total: number;
  source: 'remote' | 'mock';
}> {
  if (!shouldUseReal()) {
    return { list: [], total: 0, source: 'mock' };
  }
  try {
    const body = await adminUserApi.adminUserList({ page: 1, pageSize: 200, ...params });
    const list = Array.isArray(body?.list) ? body.list.map(apiUserToSystemUser) : [];
    return { list, total: typeof body?.total === 'number' ? body.total : list.length, source: 'remote' };
  } catch (error) {
    Message.warning(`${describeError(error, '加载用户列表失败')}，已使用本地数据`);
    return { list: [], total: 0, source: 'mock' };
  }
}

/** 角色组列表（真实开关开→远程真组；关/未登录→空 + source='mock'）。 */
export async function loadAdminUserGroups(): Promise<{
  list: AdminUserGroupApi[];
  source: 'remote' | 'mock';
}> {
  if (!shouldUseReal()) {
    return { list: [], source: 'mock' };
  }
  try {
    const body = await adminUserApi.adminUserGroupsList({ page: 1, pageSize: 200 });
    const list = Array.isArray(body?.list) ? body.list : [];
    return { list, source: 'remote' };
  } catch (error) {
    Message.warning(`${describeError(error, '加载角色列表失败')}，已使用本地数据`);
    return { list: [], source: 'mock' };
  }
}

/** 菜单树（getMenu 使用当前登录用户 groupid；关/未登录→空 + source='mock'）。 */
export async function loadMenuTree(): Promise<{
  tree: AdminMenuNodeApi[];
  source: 'remote' | 'mock';
}> {
  if (!shouldUseReal()) {
    return { tree: [], source: 'mock' };
  }
  try {
    const tree = await adminUserApi.getMenu();
    return { tree: Array.isArray(tree) ? tree : [], source: 'remote' };
  } catch (error) {
    Message.warning(`${describeError(error, '加载菜单树失败')}，已使用本地数据`);
    return { tree: [], source: 'mock' };
  }
}

/** 创建用户（真实开关开→远程返回新 id；关/未登录→返回 null 由 store 本地构建）。 */
export async function createAdminUserRemote(input: AdminUserInput): Promise<{ id: number } | null> {
  if (!shouldUseReal()) return null;
  return adminUserApi.adminUserCreate(toCreatePayload(input));
}

/** 更新用户（真实开关开→调 api）。 */
export async function updateAdminUserRemote(input: AdminUserInput): Promise<void> {
  if (!shouldUseReal()) return;
  await adminUserApi.adminUserUpdate(toUpdatePayload(input));
}

/** 删除用户（真实开关开→调 api）。 */
export async function deleteAdminUserRemote(id: number | string): Promise<void> {
  if (!shouldUseReal()) return;
  await adminUserApi.adminUserDelete(id);
}

/** 修改密码（真实开关开→调 api；作用于当前登录用户）。 */
export async function changePasswordRemote(payload: { password: string; newPassword: string }): Promise<void> {
  if (!shouldUseReal()) return;
  await adminUserApi.changePassword(payload);
}
