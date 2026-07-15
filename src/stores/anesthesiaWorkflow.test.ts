import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const api = vi.hoisted(() => ({
  planDetail: vi.fn(),
  planSaveDraft: vi.fn(),
  planSubmit: vi.fn(),
  planCancel: vi.fn(),
  planCreateRevision: vi.fn(),
  handoverDetail: vi.fn(),
  handoverSaveDraft: vi.fn(),
  handoverSubmit: vi.fn(),
  handoverAccept: vi.fn(),
  handoverCancel: vi.fn(),
  summaryDetail: vi.fn(),
  summaryGenerate: vi.fn(),
  summarySaveDraft: vi.fn(),
  summarySubmit: vi.fn(),
}));

vi.mock('@/api/anesthesiaWorkflow', () => ({
  anesthesiaPlanApi: {
    detail: api.planDetail,
    saveDraft: api.planSaveDraft,
    submit: api.planSubmit,
    cancel: api.planCancel,
    createRevision: api.planCreateRevision,
  },
  anesthesiaHandoverApi: {
    detail: api.handoverDetail,
    saveDraft: api.handoverSaveDraft,
    submit: api.handoverSubmit,
    accept: api.handoverAccept,
    cancelDraft: api.handoverCancel,
  },
  anesthesiaSummaryApi: {
    detail: api.summaryDetail,
    generate: api.summaryGenerate,
    saveDraft: api.summarySaveDraft,
    submit: api.summarySubmit,
  },
}));

import {
  useAnesthesiaHandoverStore,
  useAnesthesiaPlanStore,
  useAnesthesiaSummaryStore,
} from '@/stores/anesthesiaWorkflow';

const plan = {
  planId: 'PLAN-1', planVersionId: 'PLANV-1', operationId: 'OP-1', version: 1,
  status: 'draft' as const, primaryMethodCode: 'general', primaryMethodName: '全身麻醉',
  alternativeMethods: [], airwayPlan: { strategy: 'endotracheal' }, monitoringPlan: { ecg: true },
  inductionPlan: '静脉诱导', maintenancePlan: '静吸复合', analgesiaPlan: '多模式镇痛', fluidPlan: '',
  bloodPreparation: '', postoperativeDestination: 'PACU', specialRisks: [], notes: '', revisionReason: null,
  vascularAccessPlan: [], fluidPlanDetail: [], transfusionPlan: null, backupPlan: null, riskResponsePlan: [],
  templateCode: null, templateVersion: null, templateSnapshot: null, plannerId: 'D1', plannerName: '甲医生',
  submittedAt: null, cancelledAt: null, createdAt: '2026-07-11 09:00:00', updatedAt: '2026-07-11 09:00:00',
};

const handover = {
  handoverId: 'HO-1', handoverVersionId: 'HOV-1', operationId: 'OP-1', version: 1,
  handoverType: 'shift_change', status: 'draft' as const, outgoingDoctorId: 'D1', outgoingDoctorName: '甲医生',
  incomingDoctorId: 'D2', incomingDoctorName: '乙医生', handoverAt: null, acceptedAt: null,
  priorityNotes: '关注血压', specialNotes: '', emergencyReason: null,
  responsibilities: [], activeProblems: [], riskItems: [], equipment: [], lines: [], activeMedications: [],
  pendingTasks: [{ code: 'TASK-1', description: '复查血气' }], clinicalSnapshot: null, cancelReason: null,
  checks: [{ itemCode: 'equipment', result: 'confirmed' as const, remark: '' }],
  createdAt: '2026-07-11 09:00:00', updatedAt: '2026-07-11 09:00:00',
};

const summary = {
  summaryId: 'SUM-1', summaryVersionId: 'SUMV-1', operationId: 'OP-1', version: 1,
  status: 'draft' as const,
  generatedPayload: {
    operationId: 'OP-1', generatedAt: '2026-07-11 10:00:00', source: { recordRevisionId: 'REV-1', recordContentHash: 'a'.repeat(64) },
    case: { diagnosis: '诊断', surgeryName: '手术', anesthesiaMethod: '全身麻醉', asa: 'II' },
    timeline: { recordStart: null, recordEnd: null, anesthesiaStart: null, anesthesiaEnd: null, surgeryStart: null, surgeryEnd: null, anesthesiaDurationMinutes: 60, surgeryDurationMinutes: 45 },
    airway: [], ventilation: [], monitoring: {}, medications: [], fluids: [], transfusions: [], ioRecords: [], labAbnormalities: [], events: [], rescueEvents: [], recovery: null, outcome: { postoperativeDestination: 'PACU' },
  }, effectRating: 'good',
  doctorSupplement: { effectRating: 'good' },
  intraoperativeNotes: '过程平稳', recoveryNotes: '苏醒良好', complicationSummary: '无',
  postoperativeDestination: 'PACU', submittedAt: null, signedAt: null, printedAt: null, archivedAt: null,
  cancelledAt: null, cancelReason: null, sourceRecordRevisionId: 'REV-1', sourceContentHash: 'a'.repeat(64),
  contentHash: null, signatureDocumentId: null, revisionReason: null, createdAt: '2026-07-11 10:00:00', updatedAt: '2026-07-11 10:00:00',
};

describe('anesthesia workflow stores', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('loads and saves an anesthesia plan using the server version contract', async () => {
    api.planDetail
      .mockResolvedValueOnce({ operationId: 'OP-1', operationCase: {}, currentPlan: plan, historyMeta: { total: 1, versions: [] } })
      .mockResolvedValueOnce({ operationId: 'OP-1', operationCase: {}, currentPlan: { ...plan, notes: '高风险病例', version: 2 }, historyMeta: { total: 1, versions: [] } })
      .mockResolvedValueOnce({ operationId: 'OP-1', operationCase: {}, currentPlan: { ...plan, notes: '高风险病例', status: 'submitted', version: 3 }, historyMeta: { total: 1, versions: [] } });
    api.planSaveDraft.mockResolvedValue({ ...plan, notes: '高风险病例', version: 2 });
    api.planSubmit.mockResolvedValue({ ...plan, notes: '高风险病例', status: 'submitted', version: 3 });
    const store = useAnesthesiaPlanStore();

    await store.load('OP-1');
    await store.saveDraft({ notes: '高风险病例' });
    await store.submit();

    expect(store.loadedOperationId).toBe('OP-1');
    expect(store.detail?.currentPlan?.planVersionId).toBe('PLANV-1');
    expect(api.planSaveDraft).toHaveBeenCalledWith(expect.objectContaining({
      operationId: 'OP-1', planVersionId: 'PLANV-1', expectedVersion: 1, notes: '高风险病例',
    }));
    expect(store.detail?.currentPlan).toMatchObject({ notes: '高风险病例', status: 'submitted' });
  });

  it('uses current server version for cancel and revision', async () => {
    api.planDetail
      .mockResolvedValueOnce({ operationId: 'OP-1', operationCase: {}, currentPlan: { ...plan, status: 'submitted', version: 3 }, historyMeta: { total: 1, versions: [] } })
      .mockResolvedValueOnce({ operationId: 'OP-1', operationCase: {}, currentPlan: { ...plan, status: 'cancelled', version: 4, revisionReason: '改期' }, historyMeta: { total: 1, versions: [] } })
      .mockResolvedValueOnce({ operationId: 'OP-1', operationCase: {}, currentPlan: { ...plan, planVersionId: 'PLANV-2', status: 'draft', version: 5, revisionReason: '重拟' }, historyMeta: { total: 2, versions: [] } });
    api.planCancel.mockResolvedValue({ ...plan, status: 'cancelled', version: 4, revisionReason: '改期' });
    api.planCreateRevision.mockResolvedValue({ ...plan, planVersionId: 'PLANV-2', status: 'draft', version: 5, revisionReason: '重拟' });
    const store = useAnesthesiaPlanStore(); await store.load('OP-1'); await store.cancel('改期'); await store.createRevision('重拟');
    expect(api.planCancel).toHaveBeenCalledWith({ planVersionId: 'PLANV-1', expectedVersion: 3, reason: '改期' });
    expect(api.planCreateRevision).toHaveBeenCalledWith({ planVersionId: 'PLANV-1', expectedVersion: 4, reason: '重拟' });
    expect(store.detail?.currentPlan?.version).toBe(5);
  });

  it('keeps a real request failure visible instead of replacing it with mock success', async () => {
    api.planDetail.mockRejectedValue(new Error('network_unavailable'));
    const store = useAnesthesiaPlanStore();

    await expect(store.load('OP-1')).rejects.toThrow('network_unavailable');

    expect(store.detail).toBeNull();
    expect(store.error).toBe('network_unavailable');
    expect(store.loading).toBe(false);
  });

  it('validates exception handover checks before calling submit and supports recipient acceptance', async () => {
    api.handoverDetail
      .mockResolvedValueOnce({ operationId: 'OP-1', operationCase: {}, activeHandover: handover, history: [], currentResponsibleDoctor: null })
      .mockResolvedValueOnce({ operationId: 'OP-1', operationCase: {}, activeHandover: { ...handover, status: 'submitted', version: 2 }, history: [], currentResponsibleDoctor: null })
      .mockResolvedValueOnce({ operationId: 'OP-1', operationCase: {}, activeHandover: { ...handover, status: 'accepted', version: 3 }, history: [], currentResponsibleDoctor: null });
    api.handoverSubmit.mockResolvedValue({ ...handover, status: 'submitted', version: 2 });
    api.handoverAccept.mockResolvedValue({ ...handover, status: 'accepted', version: 3 });
    const store = useAnesthesiaHandoverStore();
    await store.load('OP-1');

    store.detail!.activeHandover!.checks = [{ itemCode: 'equipment', result: 'exception', remark: '' }];
    await expect(store.submit()).rejects.toThrow('异常核查项必须填写备注');
    expect(api.handoverSubmit).not.toHaveBeenCalled();

    store.detail!.activeHandover!.checks[0].remark = '备用机已切换';
    await store.submit();
    await store.accept();
    expect(api.handoverAccept).toHaveBeenCalledWith({ handoverVersionId: 'HOV-1', expectedVersion: 2 });
    expect(store.detail?.activeHandover?.status).toBe('accepted');
  });

  it('generates, saves and submits a server summary without writing the legacy local summary', async () => {
    api.summaryDetail
      .mockResolvedValueOnce({ operationId: 'OP-1', operationCase: {}, currentSummary: null, history: [] })
      .mockResolvedValueOnce({ operationId: 'OP-1', operationCase: {}, currentSummary: summary, history: [] })
      .mockResolvedValueOnce({ operationId: 'OP-1', operationCase: {}, currentSummary: { ...summary, effectRating: 'excellent', version: 2 }, history: [] })
      .mockResolvedValueOnce({ operationId: 'OP-1', operationCase: {}, currentSummary: { ...summary, effectRating: 'excellent', status: 'submitted', version: 3 }, history: [] });
    api.summaryGenerate.mockResolvedValue(summary);
    api.summarySaveDraft.mockResolvedValue({ ...summary, effectRating: 'excellent', version: 2 });
    api.summarySubmit.mockResolvedValue({ ...summary, effectRating: 'excellent', status: 'submitted', version: 3 });
    const store = useAnesthesiaSummaryStore();

    await store.load('OP-1');
    await store.generate();
    await store.saveDraft({ effectRating: 'excellent' });
    await store.submit();

    expect(api.summarySaveDraft).toHaveBeenCalledWith(expect.objectContaining({
      summaryVersionId: 'SUMV-1', expectedVersion: 1, effectRating: 'excellent',
    }));
    expect(api.summaryGenerate).toHaveBeenCalledWith({ operationId: 'OP-1', expectedVersion: 0 });
    expect(store.detail?.currentSummary?.status).toBe('submitted');
  });
});
