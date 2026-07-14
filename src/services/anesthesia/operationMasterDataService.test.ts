import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SurgeryCase } from '@/types/anesthesia';

vi.mock('@/api/operationInfo', () => ({
  operationInfoApi: {
    updateMasterData: vi.fn(async () => ({})),
    updateOperationInfo: vi.fn(async () => ({})),
    getOperationInfo: vi.fn(async () => ({ operationCase: { operationId: 'op-1', patientName: '远端新姓名', gender: '女', version: 9 } })),
  },
}));
vi.mock('@/api/auth', () => ({
  authApi: {
    auditByOperation: vi.fn(async () => ({ list: [{
      module: 'operation', action: 'masterDataUpdate', actorId: 'u1', actorRole: '麻醉医生', occurredAt: '2026-07-13 10:00:00',
      changeSummary: [{ field: 'patientName', label: '患者姓名', before: '旧', after: '新', reason: '修正' }],
    }] })),
  },
}));

import { operationInfoApi } from '@/api/operationInfo';
import { SamisHttpError } from '@/api/samisHttpClient';
import {
  MASTER_DATA_PERMISSION,
  MasterDataConflictError,
  auditResultLabel,
  canEditMasterData,
  formatMasterDataAudit,
  saveMasterDataWithReadback,
} from '@/services/anesthesia/operationMasterDataService';

const baseItem = (): SurgeryCase => ({
  id: 'op-1', room: 'OR-01', sequence: 1, patientName: '旧姓名', gender: '男', age: 40,
  department: '外科', diagnosis: '诊断', surgeryName: '手术', surgeon: '李', anesthesiaMethod: '全麻',
  asa: 'II', urgency: '择期', anesthesiologist: '王', anesthesiaNurse: '陈', status: '待入室',
  locationType: '手术室内', plannedStart: '2026-07-13T08:00:00.000Z', expectedDurationMinutes: 60,
  locked: false, activeWarming: false, autologousBlood: false, postoperativeAnalgesia: false,
  preVisit: { completed: false, height: 170, weight: 65, asa: 'II', allergy: '无', anesthesiaHistory: '', difficultAirway: '', fasting: '', preMedication: '', specialCondition: '', plan: '', doctorSignature: '' },
  vitals: [{ time: '2026-07-13T08:05:00.000Z', HR: 80 }], events: [], medications: [], fluids: [],
  outputs: { urine: 0, bloodLoss: 0, drainage: 0 },
});

describe('operationMasterDataService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('canEditMasterData honors wildcard and explicit permission', () => {
    expect(canEditMasterData(['*'])).toBe(true);
    expect(canEditMasterData([MASTER_DATA_PERMISSION])).toBe(true);
    expect(canEditMasterData(['other.permission'])).toBe(false);
    expect(canEditMasterData(null)).toBe(false);
  });

  it('formats only operation/masterDataUpdate audit entries', () => {
    const entries = formatMasterDataAudit([
      { module: 'operation', action: 'masterDataUpdate', actorId: 'u1', changeSummary: [{ field: 'patientName', label: '患者姓名', before: '旧', after: '新', reason: '修正' }] },
      { module: 'record', action: 'submit', changeSummary: [] },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].field).toBe('patientName');
    expect(entries[0].after).toBe('新');
    expect(entries[0].reason).toBe('修正');
  });

  it('saves master data then GETs readback and returns merged case with audit', async () => {
    const item = baseItem();
    const result = await saveMasterDataWithReadback({ item, reason: '修正姓名', changes: [{ field: 'patientName', value: '新姓名' }] });
    expect(vi.mocked(operationInfoApi.updateMasterData)).toHaveBeenCalledTimes(1);
    const envelope = vi.mocked(operationInfoApi.updateMasterData).mock.calls[0][0] as { operationId: string; reason: string; changes: unknown[] };
    expect(envelope.operationId).toBe('op-1');
    expect(envelope.reason).toBe('修正姓名');
    expect(envelope.changes).toEqual([{ field: 'patientName', value: '新姓名' }]);
    // GET 回读被调用
    expect(vi.mocked(operationInfoApi.getOperationInfo)).toHaveBeenCalledTimes(1);
    // 远端主数据胜出
    expect(result.case.patientName).toBe('远端新姓名');
    expect(result.case.gender).toBe('女');
    expect(result.case.operationCase?.version).toBe(9);
    // 本地临床记录保留
    expect(result.case.vitals).toHaveLength(1);
    // 审计
    expect(result.audit).toHaveLength(1);
    expect(result.audit[0].field).toBe('patientName');
  });

  it('throws MasterDataConflictError on 4091 without GET readback success state', async () => {
    vi.mocked(operationInfoApi.updateMasterData).mockRejectedValueOnce(new SamisHttpError('冲突', 4091, 4091, false));
    await expect(saveMasterDataWithReadback({ item: baseItem(), reason: 'x', changes: [{ field: 'patientName', value: '新' }] }))
      .rejects.toBeInstanceOf(MasterDataConflictError);
  });

  it('formatMasterDataAudit keeps result status for pending/success/failure', () => {
    const entries = formatMasterDataAudit([
      { module: 'operation', action: 'masterDataUpdate', result: 'pending', changeSummary: [{ field: 'patientName', before: 'a', after: 'b' }] },
      { module: 'operation', action: 'masterDataUpdate', result: 'success', changeSummary: [{ field: 'gender', before: '男', after: '女' }] },
      { module: 'operation', action: 'masterDataUpdate', result: 'failure', changeSummary: [{ field: 'age', before: 1, after: 2 }] },
    ]);
    expect(entries.map((e) => e.result)).toEqual(['pending', 'success', 'failure']);
  });

  it('auditResultLabel distinguishes pending from ordinary success', () => {
    expect(auditResultLabel('pending')).toBe('审计待确认');
    expect(auditResultLabel('success')).toBe('成功');
    expect(auditResultLabel('failure')).toBe('失败');
    expect(auditResultLabel(undefined)).toBe('—');
  });
});
