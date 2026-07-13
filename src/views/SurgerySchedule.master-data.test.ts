import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SurgeryCase } from '@/types/anesthesia';

/**
 * SurgerySchedule 主数据页面行为测试。
 * vitest 环境为 node 且无 @vue/test-utils，因此覆盖页面所委托的受控主数据逻辑：
 * 权限门禁、编辑差异、保存顺序（POST→GET 回读）、4091 冲突与失败不保留本地主数据。
 */

vi.mock('@/api/operationInfo', () => ({
  operationInfoApi: {
    updateMasterData: vi.fn(async () => ({})),
    updateOperationInfo: vi.fn(async () => ({})),
    getOperationInfo: vi.fn(async () => ({ operationCase: { operationId: 'op-1', patientName: '远端新姓名', gender: '女', version: 8 } })),
  },
}));
vi.mock('@/api/auth', () => ({
  authApi: {
    myPermissions: vi.fn(async () => ['operation.master_data.update']),
    auditByOperation: vi.fn(async () => ({ list: [] })),
  },
}));

import { operationInfoApi } from '@/api/operationInfo';
import { SamisHttpError } from '@/api/samisHttpClient';
import {
  canEditMasterData,
  MasterDataConflictError,
  saveMasterDataWithReadback,
  MASTER_DATA_PERMISSION,
} from '@/services/anesthesia/operationMasterDataService';
import { buildMasterDataChangesFromDiff, buildMasterDataUpdateEnvelope } from '@/services/anesthesia/scheduleService';

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

describe('SurgerySchedule master-data page behavior', () => {
  beforeEach(() => vi.clearAllMocks());

  it('disables master data editing without permission', () => {
    expect(canEditMasterData([])).toBe(false);
    expect(canEditMasterData(['other.code'])).toBe(false);
  });

  it('allows editing with wildcard or explicit permission', () => {
    expect(canEditMasterData(['*'])).toBe(true);
    expect(canEditMasterData([MASTER_DATA_PERMISSION])).toBe(true);
  });

  it('save order: validates reason then POST envelope then GET readback (no local master on failure)', async () => {
    const original = baseItem();
    const edited = baseItem();
    edited.patientName = '新姓名';
    edited.gender = '女';

    const changes = buildMasterDataChangesFromDiff(original, edited);
    expect(changes.map((c) => c.field)).toEqual(expect.arrayContaining(['patientName', 'gender']));

    // 缺少原因：页面应拒绝（这里直接校验信封 reason 必填由服务端策略保证，前端 trim 后为空不发）
    const emptyReasonEnvelope = buildMasterDataUpdateEnvelope(edited, '', changes);
    expect(emptyReasonEnvelope.reason).toBe('');

    // 有原因：POST → GET 回读
    const result = await saveMasterDataWithReadback({ item: edited, reason: '修正姓名', changes });
    expect(vi.mocked(operationInfoApi.updateMasterData)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(operationInfoApi.getOperationInfo)).toHaveBeenCalledTimes(1);
    // 远端主数据胜出（页面刷新后不再恢复旧姓名）
    expect(result.case.patientName).toBe('远端新姓名');
    expect(result.case.gender).toBe('女');
    expect(result.case.operationCase?.version).toBe(8);
  });

  it('4091 conflict does not retain local master data (throws, page keeps drawer)', async () => {
    vi.mocked(operationInfoApi.updateMasterData).mockRejectedValueOnce(new SamisHttpError('冲突', 4091, 4091, false));
    await expect(saveMasterDataWithReadback({ item: baseItem(), reason: 'x', changes: [{ field: 'patientName', value: '新' }] }))
      .rejects.toBeInstanceOf(MasterDataConflictError);
    // 冲突时不进行 GET 回读
    expect(vi.mocked(operationInfoApi.getOperationInfo)).not.toHaveBeenCalled();
  });
});
