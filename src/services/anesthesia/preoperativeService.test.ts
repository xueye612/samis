import { describe, expect, it } from 'vitest';
import {
  mapRequestApiToRequest,
  buildRequestPayload,
  mapConsultationApiToRecord,
  buildConsultationPayload,
  mapExamReviewApiToRecord,
  buildExamReviewPayload,
  mapConsentApiToRecord,
  buildConsentPayload,
  mapSafetyCheckApiToRecord,
  buildSafetyCheckPayload,
} from '@/services/anesthesia/preoperativeService';
import type {
  PreopRequestApi,
  PreopConsultationApi,
  PreopExamReviewApi,
  PreopConsentApi,
  PreopSafetyCheckApi,
} from '@/api/preoperative';

describe('preoperativeService adapters', () => {
  it('maps request api → SurgeryRequest (id numeric string)', () => {
    const row: PreopRequestApi = {
      id: 7,
      operationId: 'OP-1',
      patientName: '张三',
      department: '普外科',
      surgeryName: '阑尾切除',
      surgeon: '李四',
      urgency: '急诊',
      requestDate: '2026-07-06',
      status: '待接收',
    };
    const r = mapRequestApiToRequest(row);
    expect(r.id).toBe('7');
    expect(r.urgency).toBe('急诊');
    expect(r.status).toBe('待接收');
  });

  it('normalizes unknown request urgency/status to defaults', () => {
    const r = mapRequestApiToRequest({
      id: 1,
      operationId: 'x',
      urgency: 'invalid',
      status: 'garbage',
    });
    expect(r.urgency).toBe('择期');
    expect(r.status).toBe('待接收');
  });

  it('builds request payload with operationId', () => {
    const payload = buildRequestPayload(
      { patientName: 'p', urgency: '急诊', status: '待接收' },
      'OP-9',
    );
    expect(payload.operationId).toBe('OP-9');
    expect(payload.urgency).toBe('急诊');
  });

  it('maps consultation api → ConsultationRecord with normalized status', () => {
    const row: PreopConsultationApi = {
      id: 3,
      caseId: 'c1',
      patientName: '王五',
      requestDept: '心内科',
      consultDate: '2026-07-06 10:00:00',
      consultant: '赵医生',
      opinion: '可耐受全麻',
      status: '已完成',
    };
    const c = mapConsultationApiToRecord(row);
    expect(c.id).toBe('3');
    expect(c.status).toBe('已完成');
  });

  it('falls back consultation status to 待会诊 for unknown values', () => {
    const c = mapConsultationApiToRecord({ id: 1, caseId: 'c', status: 'xx' });
    expect(c.status).toBe('待会诊');
  });

  it('builds consultation payload', () => {
    const payload = buildConsultationPayload({ caseId: 'c1', status: '已完成', opinion: '意见' });
    expect(payload.operationId).toBe('c1');
    expect(payload).not.toHaveProperty('status');
  });

  it('maps examReview api → ExamReviewRecord with normalized result', () => {
    const row: PreopExamReviewApi = {
      id: 5,
      caseId: 'c2',
      patientName: '孙六',
      labItems: '血常规',
      imagingItems: '胸片',
      reviewResult: '异常',
      reviewer: '钱检验',
      reviewDate: '2026-07-06',
    };
    const e = mapExamReviewApiToRecord(row);
    expect(e.id).toBe('5');
    expect(e.reviewResult).toBe('异常');
  });

  it('normalizes unknown reviewResult to 通过', () => {
    const e = mapExamReviewApiToRecord({ id: 1, caseId: 'c', reviewResult: '??' });
    expect(e.reviewResult).toBe('通过');
  });

  it('builds examReview payload', () => {
    const payload = buildExamReviewPayload({ caseId: 'c3', reviewResult: '待补检' });
    expect(payload.reviewResult).toBe('待补检');
  });

  it('maps consent api → ConsentRecord with bool flags', () => {
    const row: PreopConsentApi = {
      id: 9,
      caseId: 'k1',
      patientName: '周七',
      surgeryName: '胆囊切除',
      anesthesiaMethod: '全麻',
      surgeryDate: '2026-07-07',
      commonRisks: true,
      severeRisks: false,
      specialRisks: true,
      planAccepted: true,
      questionAnswered: false,
      patientSigned: true,
      familySigned: false,
      doctorSigned: true,
      signedAt: '2026-07-07 09:00:00',
      status: '已提交',
    };
    const k = mapConsentApiToRecord(row);
    expect(k.id).toBe('9');
    expect(k.commonRisks).toBe(true);
    expect(k.severeRisks).toBe(false);
    expect(k.doctorSigned).toBe(true);
    expect(k.status).toBe('已提交');
    expect(k.signedAt).toBe('2026-07-07 09:00:00');
  });

  it('builds consent payload with bool flags', () => {
    const payload = buildConsentPayload({ caseId: 'k1', commonRisks: true, patientSigned: true });
    expect(payload.operationId).toBe('k1');
    expect(payload.commonRisks).toBe(true);
    expect(payload.patientSigned).toBe(true);
  });

  it('normalizes unknown consent status to 草稿', () => {
    const k = mapConsentApiToRecord({
      id: 1, caseId: 'k', commonRisks: false, severeRisks: false, specialRisks: false,
      planAccepted: false, questionAnswered: false, patientSigned: false,
      familySigned: false, doctorSigned: false, status: 'xx',
    });
    expect(k.status).toBe('草稿');
  });

  it('maps safetyCheck api → SafetyCheckRecord with bool flags', () => {
    const row: PreopSafetyCheckApi = {
      id: 11,
      caseId: 's1',
      patientName: '吴八',
      signInComplete: true,
      timeOutComplete: false,
      signOutComplete: true,
      checker: '陈核查',
      checkDate: '2026-07-07',
      status: '未完成',
    };
    const s = mapSafetyCheckApiToRecord(row);
    expect(s.id).toBe('11');
    expect(s.signInComplete).toBe(true);
    expect(s.timeOutComplete).toBe(false);
    expect(s.signOutComplete).toBe(true);
    expect(s.status).toBe('未完成');
  });

  it('builds safetyCheck payload with bool flags', () => {
    const payload = buildSafetyCheckPayload({
      caseId: 's1',
      signInComplete: true,
      timeOutComplete: true,
      signOutComplete: true,
    });
    expect(payload.signInComplete).toBe(true);
    expect(payload.signOutComplete).toBe(true);
  });

  it('normalizes unknown safetyCheck status to 未完成', () => {
    const s = mapSafetyCheckApiToRecord({
      id: 1, caseId: 's', signInComplete: false, timeOutComplete: false,
      signOutComplete: false, status: 'xx',
    });
    expect(s.status).toBe('未完成');
  });
});
