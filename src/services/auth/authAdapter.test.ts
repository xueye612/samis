import { describe, expect, it } from 'vitest';
import {
  buildAdminLoginFormBody,
  buildLoginRequestBody,
  mapCurrentUser,
  mapLoginResponse,
  unwrapAuthPayload,
} from '@/services/auth/authAdapter';

describe('authAdapter', () => {
  it('buildAdminLoginFormBody matches Apifox admin/login', () => {
    expect(buildAdminLoginFormBody('quality_admin', 'samis2026')).toEqual({
      username: 'quality_admin',
      password: 'samis2026',
    });
  });

  it('buildLoginRequestBody includes field aliases', () => {
    const body = buildLoginRequestBody('admin', 'secret');
    expect(body.username).toBe('admin');
    expect(body.loginName).toBe('admin');
    expect(body.login_name).toBe('admin');
    expect(body.password).toBe('secret');
    expect(body.pwd).toBe('secret');
  });

  it('unwrapAuthPayload reads nested data', () => {
    const payload = unwrapAuthPayload({
      code: 0,
      data: { token: 'nested-token', userName: '张三' },
    });
    expect(payload.token).toBe('nested-token');
    expect(payload.userName).toBe('张三');
  });

  it('mapLoginResponse reads token from admin/login userInfo', () => {
    const mapped = mapLoginResponse({
      code: 0,
      data: {
        token: 'jwt-top',
        userInfo: {
          id: 3000001,
          name: '质控管理员',
          GH: 'quality_admin',
          token: 'jwt-nested',
          department_code: 'ANES',
          department_name: '麻醉科',
        },
      },
    });
    expect(mapped.token).toBe('jwt-top');
    expect(mapped.user.displayName).toBe('质控管理员');
    expect(mapped.user.loginName).toBe('quality_admin');
    expect(mapped.user.defaultRoomGroup).toBe('ANES');
    expect(mapped.user.defaultRoomGroupName).toBe('麻醉科');
  });

  it('mapLoginResponse prefers api room over override when api provides', () => {
    const mapped = mapLoginResponse(
      { token: 't1', room: 'OR-02', roomGroup: '手术中心', userName: '李四' },
      { room: 'OR-01', roomGroup: '其他' },
    );
    expect(mapped.room).toBe('OR-02');
    expect(mapped.user.displayName).toBe('李四');
  });

  it('mapCurrentUser maps adminUser gh and department_name', () => {
    const user = mapCurrentUser({ name: '张三', gh: '2005', department_name: '手术中心' });
    expect(user.displayName).toBe('张三');
    expect(user.loginName).toBe('2005');
    expect(user.defaultRoomGroupName).toBe('手术中心');
  });

  it('mapLoginResponse uses override when api room empty', () => {
    const mapped = mapLoginResponse(
      { token: 't1', userName: '王五' },
      { room: 'OR-03', roomGroup: 'PACU区' },
    );
    expect(mapped.room).toBe('OR-03');
    expect(mapped.roomGroup).toBe('PACU区');
  });
});
