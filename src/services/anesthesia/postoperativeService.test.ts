import { describe, expect, it } from 'vitest';
import {
  mapFollowupApiToFollowUp,
  buildFollowupPayload,
  mapComplicationApiToRecord,
  buildComplicationPayload,
  mapCaseSummaryApiToSummary,
} from '@/services/anesthesia/postoperativeService';
import type { PostFollowupApi, PostComplicationApi, PostCaseSummaryApi } from '@/api/postoperative';

describe('postoperativeService adapters', () => {
  it('maps followup api → PostoperativeFollowUp (vasScore→vas, death24h→death)', () => {
    const row: PostFollowupApi = {
      id: 12,
      caseId: 'case-1',
      patientName: '张三',
      followupType: '全麻术后随访',
      followTime: '2026-07-05 10:00:00',
      vasScore: 6,
      nausea: true,
      headache: false,
      hoarseness: true,
      hoarsenessDurationHours: 3.5,
      numbness: false,
      motorDisorder: false,
      awareness: false,
      respiratoryDepression: false,
      reintubation: true,
      transferredIcu: false,
      newComa: false,
      neuroDurationHours: null,
      death24h: true,
      deathTime: '2026-07-05 20:00:00',
      advice: '密切观察',
    };
    const fu = mapFollowupApiToFollowUp(row);
    expect(fu.id).toBe('12');
    expect(fu.vas).toBe(6);
    expect(fu.death).toBe(true);
    expect(fu.type).toBe('全麻术后随访');
    expect(fu.hoarsenessDurationHours).toBe(3.5);
    expect(fu.nausea).toBe(true);
    expect(fu.reintubation).toBe(true);
  });

  it('falls back followupType to 术后镇痛随访 for unknown values', () => {
    const fu = mapFollowupApiToFollowUp({
      id: 1,
      caseId: 'c',
      patientName: 'p',
      followupType: 'invalid',
      followTime: '2026-07-05 10:00:00',
      vasScore: 0,
      nausea: false,
      headache: false,
      hoarseness: false,
      numbness: false,
      motorDisorder: false,
      awareness: false,
      respiratoryDepression: false,
      reintubation: false,
      transferredIcu: false,
      newComa: false,
      death24h: false,
    });
    expect(fu.type).toBe('术后镇痛随访');
  });

  it('builds followup payload mapping vas→vasScore, death→death24h', () => {
    const payload = buildFollowupPayload({
      caseId: 'c1',
      type: '术后镇痛随访',
      followTime: '2026-07-05 10:00:00',
      vas: 7,
      death: true,
      nausea: false,
    });
    expect(payload.vasScore).toBe(7);
    expect(payload.death24h).toBe(true);
    expect(payload.followupType).toBe('术后镇痛随访');
    expect(payload.vas).toBeUndefined();
  });

  it('maps complication api → ComplicationRecord with normalized severity/status', () => {
    const row: PostComplicationApi = {
      id: 5,
      caseId: 'c2',
      patientName: '李四',
      type: '低氧血症',
      severity: '危及生命',
      stage: '术中',
      symptoms: 's',
      treatment: 't',
      outcome: '好转',
      reportTime: '2026-07-05 09:00:00',
      status: '已提交',
    };
    const rec = mapComplicationApiToRecord(row);
    expect(rec.id).toBe('5');
    expect(rec.severity).toBe('危及生命');
    expect(rec.status).toBe('已提交');
  });

  it('normalizes unknown complication severity → 中度', () => {
    const rec = mapComplicationApiToRecord({
      id: 6,
      caseId: 'c',
      patientName: 'p',
      type: 'x',
      severity: 'unknown',
      reportTime: '2026-07-05 09:00:00',
      status: '草稿',
    });
    expect(rec.severity).toBe('中度');
  });

  it('builds complication payload mapping type→complicationType', () => {
    const payload = buildComplicationPayload({
      caseId: 'c3',
      type: '出血',
      severity: '重度',
      reportTime: '2026-07-05 09:00:00',
      status: '草稿',
    });
    expect(payload.complicationType).toBe('出血');
    expect(payload.severity).toBe('重度');
    expect(payload.type).toBeUndefined();
  });

  it('maps case summary api → PostCaseSummary with id=operationId', () => {
    const row: PostCaseSummaryApi = {
      operationId: 'OP-1',
      caseId: 'OP-1',
      patientName: '王五',
      surgeryName: '阑尾切除术',
      room: 'OR-01',
      recordStatus: 'recording',
      postoperativeAnalgesia: true,
      transferIcuPlanned: false,
      reintubation: false,
    };
    const s = mapCaseSummaryApiToSummary(row);
    expect(s.id).toBe('OP-1');
    expect(s.operationId).toBe('OP-1');
    expect(s.postoperativeAnalgesia).toBe(true);
    expect(s.surgeryName).toBe('阑尾切除术');
  });
});
