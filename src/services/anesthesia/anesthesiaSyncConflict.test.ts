import { describe, expect, it, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { saveCaseToLocalDb } from '@/services/anesthesia/anesthesiaRecordRepository';
import {
  canDeviceOverwriteVital,
  conflictTypeLabel,
  createSyncConflict,
  getPendingConflictCount,
  parseConflictTypeFromResult,
  resolveSyncConflict,
} from '@/services/anesthesia/anesthesiaSyncConflict';
import { resetAnesthesiaLocalDbForTests } from '@/services/anesthesia/localDb';
import type { SurgeryCase, VitalSign } from '@/types/anesthesia';

const baseCase = (): SurgeryCase => ({
  id: 'case-conflict-test',
  room: 'OR-01',
  sequence: 1,
  patientName: '冲突测试',
  gender: '男',
  age: 40,
  department: '麻醉科',
  diagnosis: '测试',
  surgeryName: '测试手术',
  surgeon: '李',
  anesthesiaMethod: '全麻',
  asa: 'II',
  urgency: '择期',
  anesthesiologist: '王',
  anesthesiaNurse: '张',
  status: '麻醉中',
  locationType: '手术室内',
  plannedStart: '2026-06-02T08:00:00.000Z',
  expectedDurationMinutes: 120,
  locked: false,
  activeWarming: false,
  autologousBlood: false,
  postoperativeAnalgesia: false,
  preVisit: {
    completed: true,
    height: 170,
    weight: 65,
    asa: 'II',
    allergy: '无',
    anesthesiaHistory: '无',
    difficultAirway: '否',
    fasting: '8h',
    preMedication: '无',
    specialCondition: '无',
    plan: '全麻',
    doctorSignature: '王',
  },
  vitals: [],
  events: [],
  medications: [{ id: 'med-1', mode: '单次用药', drug: '丙泊酚', executor: '王' }],
  fluids: [],
  outputs: { urine: 0, bloodLoss: 0, drainage: 0 },
});

describe('anesthesia sync conflict', () => {
  beforeEach(async () => {
    await resetAnesthesiaLocalDbForTests();
  });

  it('blocks device overwrite on corrected vital', () => {
    const corrected: VitalSign = {
      id: 'v1',
      time: '2026-06-02T09:00:00.000Z',
      HR: 90,
      source: '手工修正',
      correctedValue: { HR: 90 },
    };
    expect(canDeviceOverwriteVital(corrected, '设备采集')).toBe(false);
    expect(canDeviceOverwriteVital(corrected, '手工录入')).toBe(true);
  });

  it('creates and resolves conflict with server version', async () => {
    const caseItem = baseCase();
    await saveCaseToLocalDb(caseItem, 1, { skipQueue: true });
    const conflict = await createSyncConflict({
      recordLocalId: 'case-conflict-test',
      operationId: 'case-conflict-test',
      entityType: 'medication',
      entityLocalId: 'med-1',
      conflictType: 'version_mismatch',
      localPayload: { drug: '丙泊酚', dose: 100 },
      serverPayload: { drug: '丙泊酚', dose: 80 },
      localSyncVersion: 1,
      serverSyncVersion: 2,
    });
    expect(await getPendingConflictCount('case-conflict-test')).toBe(1);
    await resolveSyncConflict(conflict.conflict_id, 'use_server', caseItem);
    expect(caseItem.medications[0].dose).toBe(80);
    expect(await getPendingConflictCount('case-conflict-test')).toBe(0);
  });

  it('maps full backend conflictType enum (Slice 3e)', () => {
    const map = (t: string) => parseConflictTypeFromResult({ entityType: 'x', localId: 'l', status: 'conflict', conflictType: t });
    expect(map('version_conflict')).toBe('version_mismatch');
    expect(map('server_locked')).toBe('record_locked');
    expect(map('record_printed')).toBe('record_printed');
    expect(map('vital_corrected')).toBe('vital_corrected');
    expect(map('deleted_remote')).toBe('deleted_remote');
    expect(map('duplicate_time_point')).toBe('duplicate_time_point');
    expect(map('field_conflict')).toBe('entity_conflict');
    // 标签覆盖全量枚举（无 fallthrough 到原始 key）
    expect(conflictTypeLabel('deleted_remote')).toBe('服务端已作废');
    expect(conflictTypeLabel('duplicate_time_point')).toBe('同时间点重复');
  });
});
