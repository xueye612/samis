import { beforeEach, describe, expect, it, vi } from 'vitest';

const preoperativeApi = {
  requestList: vi.fn(),
  requestCreate: vi.fn(),
  requestUpdate: vi.fn(),
  requestReceive: vi.fn(),
  requestCancel: vi.fn(),
};

vi.mock('@/api/preoperative', () => ({ preoperativeApi }));
vi.mock('@/config/apiFlags', () => ({ useRealPreoperative: () => true }));
vi.mock('@/services/session/samisSession', () => ({ isSamisLoggedIn: () => true }));
vi.mock('@/services/auth/authErrorPresentation', () => ({ notifyIfUnhandledSamisError: vi.fn() }));
vi.mock('@arco-design/web-vue', () => ({ Message: { warning: vi.fn() } }));

const service = await import('@/services/anesthesia/preoperativeService');

describe('C1 术前通知所有权边界', () => {
  beforeEach(() => vi.clearAllMocks());

  it('新增、更新、接收和取消均在调用网络前拒绝', async () => {
    const request = { id: 'OP-C1-1', patientName: '测试患者', department: '外科', surgeryName: '测试手术', urgency: '择期', requestDate: '', status: '待接收', surgeon: '' } as const;
    await expect(service.upsertRequestRemote(request)).rejects.toBeInstanceOf(service.PreopRequestReadOnlyError);
    await expect(service.receiveRequestRemote(request.id)).rejects.toBeInstanceOf(service.PreopRequestReadOnlyError);
    await expect(service.cancelRequestRemote(request.id)).rejects.toBeInstanceOf(service.PreopRequestReadOnlyError);
    expect(preoperativeApi.requestCreate).not.toHaveBeenCalled();
    expect(preoperativeApi.requestUpdate).not.toHaveBeenCalled();
    expect(preoperativeApi.requestReceive).not.toHaveBeenCalled();
    expect(preoperativeApi.requestCancel).not.toHaveBeenCalled();
  });
});
