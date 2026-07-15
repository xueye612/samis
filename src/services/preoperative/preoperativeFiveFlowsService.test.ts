import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = {
  requestList: vi.fn(),
  requestReceive: vi.fn(),
  requestCancel: vi.fn(),
  consultationList: vi.fn(),
  consultationCreate: vi.fn(),
  consultationSubmit: vi.fn(),
  consultationCancel: vi.fn(),
  consentGetByCaseId: vi.fn(),
  consentSubmit: vi.fn(),
  consentWithdraw: vi.fn(),
  consentMarkPrinted: vi.fn(),
  consentArchive: vi.fn(),
  safetyCheckSummary: vi.fn(),
  safetyConfirmRole: vi.fn(),
};

vi.mock('@/api/preoperative', () => ({ preoperativeFiveFlowsApi: apiMock }));
vi.mock('@/api/samisHttpClient', () => ({
  SamisHttpError: class SamisHttpError extends Error {
    constructor(message: string, public status: number, public code?: number) { super(message); }
  },
}));

const {
  loadRequestList, receiveRequest, cancelRequest,
  loadConsultationList, createConsultation, submitConsultation, cancelConsultation,
  loadSafetySummary, confirmSafetyRole, PreopConflictError,
} = await import('@/services/preoperative/preoperativeFiveFlowsService');

describe('preoperativeFiveFlowsService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('loadRequestList empty stays empty', async () => {
    apiMock.requestList.mockResolvedValue({ list: [] });
    expect(await loadRequestList()).toEqual([]);
  });

  it('loadRequestList maps items preserving status/version', async () => {
    apiMock.requestList.mockResolvedValue({ list: [{ id: 1, operationId: 'OP1', status: '待接收', version: 1 }] });
    const list = await loadRequestList();
    expect(list[0].operationId).toBe('OP1');
    expect(list[0].status).toBe('待接收');
    expect(list[0].version).toBe(1);
  });

  it('receiveRequest sends id + version', async () => {
    apiMock.requestReceive.mockResolvedValue({ id: 1 });
    await receiveRequest(1, 1);
    expect(apiMock.requestReceive).toHaveBeenCalledWith({ id: 1, expectedVersion: 1 });
  });

  it('cancelRequest sends id + version + reason', async () => {
    apiMock.requestCancel.mockResolvedValue({});
    await cancelRequest(1, 1, '取消原因');
    expect(apiMock.requestCancel).toHaveBeenCalledWith({ id: 1, expectedVersion: 1, cancelReason: '取消原因' });
  });

  it('loadSafetySummary returns null on error', async () => {
    apiMock.safetyCheckSummary.mockRejectedValue(new Error('fail'));
    expect(await loadSafetySummary('OP1')).toBeNull();
  });

  it('confirmSafetyRole sends operationId + stage + confirmed', async () => {
    apiMock.safetyConfirmRole.mockResolvedValue({});
    await confirmSafetyRole('OP1', 'sign_in', true, '确认');
    expect(apiMock.safetyConfirmRole).toHaveBeenCalledWith({ operationId: 'OP1', stage: 'sign_in', confirmed: true, reason: '确认' });
  });

  it('conflict maps to PreopConflictError', async () => {
    const { SamisHttpError } = await import('@/api/samisHttpClient');
    apiMock.requestReceive.mockRejectedValueOnce(new SamisHttpError('conflict', 200, 4091));
    await expect(receiveRequest(1, 1)).rejects.toBeInstanceOf(PreopConflictError);
  });
});
