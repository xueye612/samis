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
};
