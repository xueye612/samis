import { postoperativeApi, type PostoperativeComplicationContract, type PostoperativeDetailApi, type PostoperativeFollowupContract } from '@/api/postoperative';
import { useRealPostoperative } from '@/config/apiFlags';

export interface PostoperativeDetail extends PostoperativeDetailApi {}
export type FollowupDraftInput = Omit<Partial<PostoperativeFollowupContract>, 'followupId' | 'status'> & { operationId: string };
export type ComplicationInput = Omit<Partial<PostoperativeComplicationContract>, 'reportStatus'> & { operationId: string; complicationType: string; reportStatus?: 'draft' | 'reported' };

const mockDetails = new Map<string, PostoperativeDetail>();
const emptyCase = (operationId: string) => ({ operationId });
const clone = (detail: PostoperativeDetail): PostoperativeDetail => structuredClone(detail);
function mockDetail(operationId: string, operationCase?: Record<string, unknown>): PostoperativeDetail {
  if (!mockDetails.has(operationId)) mockDetails.set(operationId, { operationCase: operationCase ?? emptyCase(operationId), followup: null, complications: [], nursingVisitSummary: null });
  const detail = mockDetails.get(operationId)!; if (operationCase) detail.operationCase = operationCase; return detail;
}

export function buildFollowupDraftPayload(input: FollowupDraftInput): Record<string, unknown> {
  const keys = ['operationId','followupAt','followupMethod','painScore','nauseaVomiting','soreThroat','awareness','satisfaction','analgesiaPlan','notes','evaluatorId','evaluatorName'];
  return Object.fromEntries(keys.filter((key) => input[key as keyof FollowupDraftInput] !== undefined).map((key) => [key, input[key as keyof FollowupDraftInput]]));
}
export function buildComplicationSavePayload(input: ComplicationInput): Record<string, unknown> {
  const keys = ['operationId','complicationId','complicationType','severity','occurredAt','description','treatment','outcome','reportStatus','reporterId','reporterName'];
  return Object.fromEntries(keys.filter((key) => input[key as keyof ComplicationInput] !== undefined).map((key) => [key, input[key as keyof ComplicationInput]]));
}

export async function loadPostoperativeDetail(operationId: string, operationCase?: Record<string, unknown>): Promise<PostoperativeDetail> {
  return useRealPostoperative() ? postoperativeApi.followupDetail(operationId) : clone(mockDetail(operationId, operationCase));
}
export async function saveFollowupDraft(input: FollowupDraftInput, operationCase?: Record<string, unknown>): Promise<PostoperativeDetail> {
  const payload=buildFollowupDraftPayload(input); if(useRealPostoperative()) return postoperativeApi.followupSaveDraft(payload);
  const detail=mockDetail(input.operationId,operationCase); if(detail.followup?.status==='submitted') throw new Error('已提交随访不能保存草稿');
  detail.followup={ operationId:input.operationId,followupId:detail.followup?.followupId??`mock-followup-${Date.now()}`,status:'draft',nauseaVomiting:false,soreThroat:false,awareness:false,...payload } as PostoperativeFollowupContract; return clone(detail);
}
export async function submitFollowup(operationId:string):Promise<PostoperativeDetail>{if(useRealPostoperative())return postoperativeApi.followupSubmit(operationId);const d=mockDetail(operationId);if(d.followup?.status!=='draft')throw new Error('随访状态不允许提交');d.followup.status='submitted';return clone(d);}
export async function cancelFollowup(operationId:string):Promise<PostoperativeDetail>{if(useRealPostoperative())return postoperativeApi.followupCancelSubmit(operationId);const d=mockDetail(operationId);if(d.followup?.status!=='submitted')throw new Error('随访状态不允许撤回');d.followup.status='cancelled';return clone(d);}
export async function saveComplication(input:ComplicationInput,operationCase?:Record<string,unknown>):Promise<PostoperativeDetail>{const payload=buildComplicationSavePayload(input);if(useRealPostoperative())return postoperativeApi.complicationSave(payload);const d=mockDetail(input.operationId,operationCase);const existing=input.complicationId?d.complications.find((x)=>x.complicationId===input.complicationId):undefined;if(existing?.reportStatus==='voided')throw new Error('已作废并发症不能编辑');const row={operationId:input.operationId,complicationId:existing?.complicationId??`mock-complication-${Date.now()}`,severity:'moderate',reportStatus:'draft',...payload} as PostoperativeComplicationContract;if(existing)Object.assign(existing,row);else d.complications.unshift(row);return clone(d);}
export async function voidComplication(operationId:string,complicationId:string,voidReason?:string):Promise<PostoperativeDetail>{if(useRealPostoperative())return postoperativeApi.complicationVoid(operationId,complicationId,voidReason);const d=mockDetail(operationId);const row=d.complications.find((x)=>x.complicationId===complicationId);if(!row)throw new Error('并发症不存在');if(row.reportStatus==='voided')throw new Error('并发症已作废');row.reportStatus='voided';row.voidReason=voidReason;return clone(d);}
export function resetPostoperativeMock():void{mockDetails.clear();}
