import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = {
  requestList: vi.fn(),
  requestReceive: vi.fn(),
  requestCancel: vi.fn(),
  safetyCheckSummary: vi.fn(),
  safetyConfirmRole: vi.fn(),
};
const legacyApiMock = {
  consultationList: vi.fn(),
  consultationCreate: vi.fn(),
  consultationUpdate: vi.fn(),
  consultationSubmit: vi.fn(),
  consultationCancel: vi.fn(),
  consentGetByCaseId: vi.fn(),
  consentCreate: vi.fn(),
  consentUpdate: vi.fn(),
  consentSubmit: vi.fn(),
  consentWithdraw: vi.fn(),
  consentMarkPrinted: vi.fn(),
  consentArchive: vi.fn(),
};

vi.mock('@/api/preoperative', () => ({
  preoperativeFiveFlowsApi: apiMock,
  preoperativeApi: legacyApiMock,
}));
vi.mock('@/api/samisHttpClient', () => ({
  SamisHttpError: class SamisHttpError extends Error {
    constructor(message: string, public status: number, public code?: number) { super(message); }
  },
}));

const {
  loadRequestList, receiveRequest, cancelRequest,
  loadConsultationList, createConsultation, updateConsultation, submitConsultation, cancelConsultation,
  loadConsentByCaseId, createConsent, updateConsent, submitConsent, withdrawConsent, markConsentPrinted, archiveConsent,
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
    await cancelRequest(1, 1, '取消');
    expect(apiMock.requestCancel).toHaveBeenCalledWith({ id: 1, expectedVersion: 1, cancelReason: '取消' });
  });

  it('loadConsultationList uses legacy API', async () => {
    legacyApiMock.consultationList.mockResolvedValue({ list: [{ id: 1, status: '待会诊' }] });
    const list = await loadConsultationList({ caseId: 'OP1' });
    expect(list).toHaveLength(1);
    expect(legacyApiMock.consultationList).toHaveBeenCalled();
  });

  it('createConsultation sends operationId', async () => {
    legacyApiMock.consultationCreate.mockResolvedValue({ id: 10 });
    const result = await createConsultation('OP1', { consultant: '医生' });
    expect(result.id).toBe(10);
    expect(legacyApiMock.consultationCreate).toHaveBeenCalledWith({ operationId: 'OP1', consultant: '医生' });
  });

  it('submitConsultation sends id', async () => {
    legacyApiMock.consultationSubmit.mockResolvedValue({});
    await submitConsultation(10);
    expect(legacyApiMock.consultationSubmit).toHaveBeenCalledWith(10);
  });

  it('cancelConsultation sends id + reason', async () => {
    legacyApiMock.consultationCancel.mockResolvedValue({});
    await cancelConsultation(10, '原因');
    expect(legacyApiMock.consultationCancel).toHaveBeenCalledWith(10, '原因');
  });

  it('loadConsentByCaseId returns null for empty', async () => {
    legacyApiMock.consentGetByCaseId.mockResolvedValue({});
    expect(await loadConsentByCaseId('OP1')).toBeNull();
  });

  it('createConsent sends operationId', async () => {
    legacyApiMock.consentCreate.mockResolvedValue({ id: 20 });
    const result = await createConsent('OP1', { templateCode: 'TPL1' });
    expect(result.id).toBe(20);
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
