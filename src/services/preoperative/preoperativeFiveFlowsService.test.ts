import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = {
  requestList: vi.fn(), requestReceive: vi.fn(), requestCancel: vi.fn(),
  consultationList: vi.fn(), consultationCreate: vi.fn(), consultationUpdate: vi.fn(), consultationSubmit: vi.fn(), consultationCancel: vi.fn(),
  examReviewList: vi.fn(), examReviewCreate: vi.fn(), examReviewUpdate: vi.fn(),
  consentGetByCaseId: vi.fn(), consentCreate: vi.fn(), consentUpdate: vi.fn(), consentPrepareSigning: vi.fn(), consentSubmit: vi.fn(), consentWithdraw: vi.fn(), consentMarkPrinted: vi.fn(), consentArchive: vi.fn(),
  safetyCheckSummary: vi.fn(), safetyConfirmRole: vi.fn(),
};
vi.mock('@/api/preoperative', () => ({ preoperativeFiveFlowsApi: api }));
vi.mock('@/api/samisHttpClient', () => ({ SamisHttpError: class SamisHttpError extends Error { constructor(message: string, public status: number, public code?: number) { super(message); } } }));

const service = await import('@/services/preoperative/preoperativeFiveFlowsService');
const request = { id: 0, operationId: 'OP1', version: 0, status: '待接收', operationCase: { operationId: 'OP1', patientName: '患者甲' } } as never;
const consultation = { id: 10, operationId: 'OP1', version: 2, status: '待会诊' } as never;
const review = { id: 20, operationId: 'OP1', version: 3, items: [] } as never;
const consent = { id: 30, operationId: 'OP1', version: 4, status: '草稿' } as never;

describe('preoperativeFiveFlowsService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('自然病例列表保持真实空，不回填 seed', async () => { api.requestList.mockResolvedValue({ list: [] }); expect(await service.loadRequestList()).toEqual([]); });
  it('从申请自然集合提取唯一 OperationCase', async () => {
    api.requestList.mockResolvedValue({ list: [request, request] });
    const cases = await service.loadOperationCases();
    expect(cases).toHaveLength(1); expect(cases[0].patientName).toBe('患者甲');
  });
  it('接收信封只带状态键和显式版本', async () => {
    api.requestReceive.mockResolvedValue({ id: 1 }); await service.receiveRequest(request);
    expect(api.requestReceive).toHaveBeenCalledWith({ id: 0, operationId: 'OP1', expectedVersion: 0 });
  });
  it('取消信封包含原因且不含患者字段', async () => {
    api.requestCancel.mockResolvedValue({ id: 1 }); await service.cancelRequest(request, '患者取消');
    expect(api.requestCancel).toHaveBeenCalledWith({ id: 0, operationId: 'OP1', expectedVersion: 0, cancelReason: '患者取消' });
  });
  it('会诊全部动作携带服务端 ID 和版本', async () => {
    api.consultationList.mockResolvedValue({ list: [consultation] }); expect(await service.loadConsultationList()).toHaveLength(1);
    api.consultationCreate.mockResolvedValue(consultation); await service.createConsultation('OP1', { consultant: '医生' });
    api.consultationUpdate.mockResolvedValue(consultation); await service.updateConsultation(consultation, { opinion: '可手术' });
    api.consultationSubmit.mockResolvedValue(consultation); await service.submitConsultation(consultation);
    api.consultationCancel.mockResolvedValue(consultation); await service.cancelConsultation(consultation, '变更计划');
    expect(api.consultationUpdate).toHaveBeenCalledWith({ id: 10, expectedVersion: 2, opinion: '可手术' });
    expect(api.consultationSubmit).toHaveBeenCalledWith({ id: 10, expectedVersion: 2 });
    expect(api.consultationCancel).toHaveBeenCalledWith({ id: 10, expectedVersion: 2, cancelReason: '变更计划' });
  });
  it('检查保存携带明确来源集合和版本', async () => {
    const items = [{ sourceType: 'manual', itemCode: 'HB', itemName: '血红蛋白', recordedBy: 'u1', recordedAt: '2026-07-15 12:00:00' }];
    api.examReviewCreate.mockResolvedValue(review); await service.createExamReview('OP1', { items });
    api.examReviewUpdate.mockResolvedValue(review); await service.updateExamReview(review, { items });
    expect(api.examReviewCreate).toHaveBeenCalledWith({ operationId: 'OP1', items });
    expect(api.examReviewUpdate).toHaveBeenCalledWith({ id: 20, expectedVersion: 3, items });
  });
  it('同意书每个写动作携带当前版本', async () => {
    for (const fn of ['consentUpdate','consentPrepareSigning','consentSubmit','consentWithdraw','consentMarkPrinted','consentArchive'] as const) api[fn].mockResolvedValue(consent);
    await service.updateConsent(consent, { riskDisclosure: '风险' }); await service.prepareConsentSigning(consent); await service.submitConsent(consent);
    await service.withdrawConsent(consent, '修订'); await service.markConsentPrinted(consent); await service.archiveConsent(consent);
    expect(api.consentUpdate).toHaveBeenCalledWith({ id: 30, expectedVersion: 4, riskDisclosure: '风险' });
    expect(api.consentArchive).toHaveBeenCalledWith({ id: 30, expectedVersion: 4 });
  });
  it('护理摘要错误向页面传播，不伪装为空', async () => { api.safetyCheckSummary.mockRejectedValue(new Error('护理连接失败')); await expect(service.loadSafetySummary('OP1')).rejects.toThrow('护理连接失败'); });
  it('护理确认返回服务端重新读取的摘要', async () => { const summary = { operationId: 'OP1', source: 'huli', status: 'incomplete', stages: [] }; api.safetyConfirmRole.mockResolvedValue({ summary }); expect(await service.confirmSafetyRole('OP1','sign_in',true)).toEqual(summary); });
  it('4091 统一映射为前端冲突错误', async () => { const { SamisHttpError } = await import('@/api/samisHttpClient'); api.requestReceive.mockRejectedValue(new SamisHttpError('conflict',200,4091)); await expect(service.receiveRequest(request)).rejects.toBeInstanceOf(service.PreopConflictError); });
});
