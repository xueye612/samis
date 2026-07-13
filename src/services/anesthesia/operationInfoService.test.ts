import { describe, expect, it, vi } from 'vitest';
import type { SurgeryCase } from '@/types/anesthesia';

vi.mock('@/config/apiFlags', () => ({ useRealOperationInfo: () => true }));
vi.mock('@/api/operationInfo', () => ({
  operationInfoApi: {
    getOperationInfo: vi.fn(async (params: { operationId?: string }) => ({
      operationCase: { operationId: params.operationId, patientName: '远端姓名', gender: '女', version: 8 },
    })),
  },
}));

import { loadOperationCaseById } from '@/services/anesthesia/operationInfoService';
import { operationInfoApi } from '@/api/operationInfo';

describe('loadOperationCaseById', () => {
  it('forces a real GET even when a local case exists and merges remote master with local clinical', async () => {
    const getOperationInfo = vi.mocked(operationInfoApi.getOperationInfo);
    getOperationInfo.mockClear();

    const existing: SurgeryCase = {
      id: 'op-force-get',
      room: 'OR-01',
      sequence: 1,
      patientName: '本地旧姓名',
      gender: '男',
      age: 40,
      department: '外科',
      diagnosis: '旧诊断',
      surgeryName: '旧手术',
      surgeon: '李',
      anesthesiaMethod: '全麻',
      asa: 'II',
      urgency: '择期',
      anesthesiologist: '王',
      anesthesiaNurse: '陈',
      status: '麻醉中',
      locationType: '手术室内',
      plannedStart: new Date().toISOString(),
      expectedDurationMinutes: 60,
      locked: false,
      activeWarming: false,
      autologousBlood: false,
      postoperativeAnalgesia: false,
      preVisit: {
        completed: false, height: 170, weight: 65, asa: 'II', allergy: '无',
        anesthesiaHistory: '', difficultAirway: '', fasting: '', preMedication: '',
        specialCondition: '', plan: '', doctorSignature: '',
      },
      vitals: [{ time: new Date().toISOString(), HR: 70 }],
      events: [],
      medications: [],
      fluids: [],
      outputs: { urine: 0, bloodLoss: 0, drainage: 0 },
    };

    const result = await loadOperationCaseById('op-force-get', existing);
    expect(getOperationInfo).toHaveBeenCalledTimes(1);
    expect(result).not.toBeNull();
    // 远端主数据胜出
    expect(result!.patientName).toBe('远端姓名');
    expect(result!.gender).toBe('女');
    expect(result!.operationCase?.version).toBe(8);
    // 本地临床记录保留
    expect(result!.vitals).toHaveLength(1);
  });
});
