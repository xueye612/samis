import { beforeEach, describe, expect, it, vi } from 'vitest';
const api=vi.hoisted(()=>({detail:vi.fn(),save:vi.fn(),submit:vi.fn(),cancel:vi.fn(),revision:vi.fn()}));
vi.mock('@/api/preoperative',()=>({preoperativeApi:{assessmentDetail:api.detail,assessmentSaveDraft:api.save,assessmentSubmit:api.submit,assessmentCancelSubmit:api.cancel,assessmentCreateRevision:api.revision}}));
import { buildPreoperativeAssessmentDraftPayload, cancelPreoperativeAssessmentSubmit, createPreoperativeAssessmentRevision, savePreoperativeAssessmentDraft, submitPreoperativeAssessment } from '@/services/anesthesia/preoperativeAssessmentService';
describe('preoperative assessment version envelope',()=>{
  beforeEach(()=>vi.clearAllMocks());
  it('keeps rich fields and excludes patient/evaluator forged fields',async()=>{
    api.save.mockResolvedValue({operationId:'OP-1',version:2,status:'draft'});
    const source={version:1,asaGrade:'III',medicalHistoryJson:[{name:'高血压'}],airwayJson:{mallampati:'III'},riskFactorsJson:[{code:'AIRWAY'}],patientName:'不得写入',evaluatorName:'伪造医生',evaluatedAt:'2000-01-01'};
    const payload=buildPreoperativeAssessmentDraftPayload('OP-1',source as never);
    expect(payload).toMatchObject({operationId:'OP-1',expectedVersion:1,asaGrade:'III',medicalHistoryJson:[{name:'高血压'}],airwayJson:{mallampati:'III'}});
    expect(payload).not.toHaveProperty('patientName'); expect(payload).not.toHaveProperty('evaluatorName'); expect(payload).not.toHaveProperty('evaluatedAt');
    await savePreoperativeAssessmentDraft('OP-1',source as never); expect(api.save).toHaveBeenCalledWith(payload);
  });
  it('uses the current version for submit, withdraw and revision',async()=>{
    const record={operationId:'OP-1',version:4}; api.submit.mockResolvedValue({}); api.cancel.mockResolvedValue({}); api.revision.mockResolvedValue({});
    await submitPreoperativeAssessment(record as never); await cancelPreoperativeAssessmentSubmit(record as never,'补充检查'); await createPreoperativeAssessmentRevision(record as never,'调整气道预案');
    expect(api.submit).toHaveBeenCalledWith({operationId:'OP-1',expectedVersion:4});
    expect(api.cancel).toHaveBeenCalledWith({operationId:'OP-1',expectedVersion:4,reason:'补充检查'});
    expect(api.revision).toHaveBeenCalledWith({operationId:'OP-1',expectedVersion:4,reason:'调整气道预案'});
  });
});
