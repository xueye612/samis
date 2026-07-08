import { samisRequest } from '@/api/samisClient';
import { buildFormPost, flatFormFieldsFromRecord } from '@/api/samisFormBody';

/** 后端 user_information 行（camelCase 兼容原始列名 GH/NumGh/MM/groupid/is_del 等）。 */
export interface AdminUserApi {
  id: number;
  name?: string;
  /** 工号/用户名 */
  GH?: string;
  NumGh?: string;
  jp?: string;
  groupid?: number;
  type?: number;
  nurse_type?: number;
  department_code?: string;
  department_name?: string;
  mobilePhone?: string;
  idCard?: string;
  /** 0=启用, 1=已删除 */
  is_del?: number;
  is_internship?: number;
  [key: string]: unknown;
}

/** adminUserList 分页响应 data（api_paginate）。 */
export interface AdminUserListResultApi {
  list: AdminUserApi[];
  page: number;
  page_size: number;
  total: number;
}

/** 后端 admin_user_group 行。 */
export interface AdminUserGroupApi {
  id: number;
  /** 角色 groupid */
  groupid: number;
  name: string;
  catids?: string;
  /** 权限菜单名集合（服务端派生） */
  catidsList?: string[];
}

/** adminUserGroupsList 响应 data（api_success 包裹服务层 {page,pageSize,total,list}）。 */
export interface AdminUserGroupListResultApi {
  page: number;
  pageSize: number;
  total: number;
  list: AdminUserGroupApi[];
}

/** getMenu 菜单树节点。 */
export interface AdminMenuNodeApi {
  id: number;
  name: string;
  pid?: number;
  url?: string | null;
  icon?: string | null;
  displayorder?: number;
  path?: string | null;
  pids?: string | null;
  childs?: string | null;
  childsList?: AdminMenuNodeApi[];
}

export interface AdminUserListQuery {
  gh?: string;
  name?: string;
  groupid?: number;
  page?: number;
  pageSize?: number;
}

export interface AdminUserGroupListQuery {
  page?: number;
  pageSize?: number;
}

export interface AdminUserCreatePayload {
  name: string;
  gh: string;
  password: string;
  groupid: number;
  department_name?: string;
  department_code?: string;
  type?: number;
  mobilePhone?: string;
}

export interface AdminUserUpdatePayload {
  id: number | string;
  name?: string;
  gh?: string;
  groupid?: number;
  password?: string;
  department_name?: string;
  department_code?: string;
  mobilePhone?: string;
}

export interface AdminChangePasswordPayload {
  password: string;
  newPassword: string;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    // 后端分页参数为 page_size（其余直传）
    const paramKey = key === 'pageSize' ? 'page_size' : key;
    query.set(paramKey, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : '';
}

function postForm<T>(path: string, data: Record<string, unknown>) {
  return samisRequest<T>(`/adminUser${path}`, buildFormPost(flatFormFieldsFromRecord(data)), {
    module: 'admin',
  });
}

export const adminUserApi = {
  // ---- 用户 ----
  adminUserList(params: AdminUserListQuery = {}) {
    return samisRequest<AdminUserListResultApi>(
      `/adminUser/adminUserList${buildQuery({
        gh: params.gh,
        name: params.name,
        groupid: params.groupid,
        page: params.page,
        pageSize: params.pageSize,
      })}`,
      undefined,
      { module: 'admin' },
    );
  },
  getAdminUserById(id: number | string) {
    return samisRequest<AdminUserApi>(
      `/adminUser/getAdminUserById?id=${encodeURIComponent(String(id))}`,
      undefined,
      { module: 'admin' },
    );
  },
  adminUserCreate(data: AdminUserCreatePayload) {
    return postForm<{ id: number }>('/adminUserCreate', data as unknown as Record<string, unknown>);
  },
  adminUserUpdate(data: AdminUserUpdatePayload) {
    return postForm<boolean>('/adminUserUpdate', data as unknown as Record<string, unknown>);
  },
  adminUserDelete(id: number | string) {
    return postForm<boolean>('/adminUserDelete', { id });
  },
  changePassword(data: AdminChangePasswordPayload) {
    return postForm<boolean>('/changePassword', data as unknown as Record<string, unknown>);
  },

  // ---- 角色组（读） ----
  adminUserGroupsList(params: AdminUserGroupListQuery = {}) {
    return samisRequest<AdminUserGroupListResultApi>(
      `/adminUserGroup/adminUserGroupsList${buildQuery({
        page: params.page,
        pageSize: params.pageSize,
      })}`,
      undefined,
      { module: 'admin' },
    );
  },
  getAdminUserGroupsById(id: number | string) {
    return samisRequest<AdminUserGroupApi>(
      `/adminUserGroup/getAdminUserGroupsById?id=${encodeURIComponent(String(id))}`,
      undefined,
      { module: 'admin' },
    );
  },

  // ---- 菜单树（getMenu 使用当前登录用户的 groupid） ----
  getMenu() {
    return samisRequest<AdminMenuNodeApi[]>(`/adminCategory/getMenu`, undefined, { module: 'admin' });
  },
};
