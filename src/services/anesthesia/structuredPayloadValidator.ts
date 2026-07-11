export interface ValidationResult { valid: boolean; code: string; reason: string }
export interface ValidationContext { rescueEventExists?: (id: string) => boolean; activeUserExists?: (id: string) => boolean }
const entities = ['airway_record','ventilation_segment','infusion_segment','transfusion_verification','rescue_event','rescue_action'] as const;
const common = ['localId','serverId','baseSyncVersion','syncVersion'];
const fields: Record<string,string[]> = {
  airway_record: [...common,'recordLocalId','airwayType','insertedAt','action','deviceCode','deviceName','deviceSize','attemptNo','airwayGrade','result','difficultyReason','extubationCondition','operatorId','operatorName','occurredAt'],
  ventilation_segment: [...common,'recordLocalId','mode','startTime','tidalVolumeMl','ratePerMin','peepCmh2o','fio2Percent','peakPressureCmh2o','etco2Mmhg','effectiveAt','endedAt','operatorId'],
  infusion_segment: [...common,'recordLocalId','medicationLocalId','startTime','drugCode','drugName','concentrationValue','concentrationUnit','rateValue','rateUnit','action','occurredAt','operatorId'],
  transfusion_verification: [...common,'recordLocalId','verificationStatus','bloodBagNo','productCode','productName','aboType','rhType','volume','volumeUnit','verifierOneId','verifierTwoId','startedAt','endedAt','reactionCode','reactionDescription','treatment','occurredAt'],
  rescue_event: [...common,'recordLocalId','eventType','occurredAt','level','status','triggerCode','triggerDescription','triggeredAt','outcome','closedAt','closedBy'],
  rescue_action: [...common,'rescueEventLocalId','actionType','payloadJson','occurredAt','operatorId'],
};
const forbidden = ['patientName','inpatientNo','department','ward','operationName'];
const ok = (): ValidationResult => ({valid:true,code:'OK',reason:'OK'});
const fail = (code:string,reason:string): ValidationResult => ({valid:false,code,reason});
export function validateStructuredPushItem(entityType:string,input:unknown,ctx:ValidationContext={}):ValidationResult {
  if (!entities.includes(entityType as never)) return fail('2001','未知entityType');
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('2002','envelope不是对象');
  const x=input as Record<string,unknown>;
  const envelopeFields = ['localId','operationId','action','clientVersion','occurredAt','payload'];
  if (Object.keys(x).some((key) => !envelopeFields.includes(key))) return fail('2003','未知envelope字段');
  for (const key of ['localId','operationId','action','clientVersion','occurredAt','payload']) if (!(key in x)) return fail('2001',`缺少${key}`);
  if (!['create','update','delete'].includes(String(x.action))) return fail('4002','非法action');
  if (!Number.isInteger(x.clientVersion) || Number(x.clientVersion)<0) return fail('4306','版本非法或冲突');
  if (Number.isNaN(Date.parse(String(x.occurredAt)))) return fail('2004','非法时间');
  if (!x.payload || typeof x.payload !== 'object' || Array.isArray(x.payload)) return fail('2002','payload不是对象');
  const p=x.payload as Record<string,unknown>;
  if (forbidden.some(k=>k in p)) return fail('4001','MASTER_DATA_WRITE_FORBIDDEN');
  if (x.action === 'delete' && Object.keys(p).some(k => ![...common,'voidReason'].includes(k))) return fail('2003','delete包含非法字段');
  if (Object.keys(p).some(k=>!fields[entityType].includes(k) && !(x.action==='delete' && k==='voidReason'))) return fail('2003','未知字段');
  if (entityType==='rescue_event' && 'status' in p && !['active','closed','cancelled'].includes(String(p.status))) return fail('4002','非法status');
  for (const k of ['tidalVolumeMl','ratePerMin','peepCmh2o','fio2Percent','concentrationValue','rateValue','volume','attemptNo']) if (k in p && typeof p[k] !== 'number') return fail('2005','非法数值类型');
  if ('fio2Percent' in p && (Number(p.fio2Percent)<21||Number(p.fio2Percent)>100)) return fail('2005','数值超范围');
  if ('rateUnit' in p && !['ml/h','mg/h','μg/kg/min'].includes(String(p.rateUnit))) return fail('2005','未知单位');
  if ('concentrationUnit' in p && !['mg/ml','μg/ml'].includes(String(p.concentrationUnit))) return fail('2005','未知单位');
  if ('volumeUnit' in p && !['ml','unit'].includes(String(p.volumeUnit))) return fail('2005','未知单位');
  if (entityType==='transfusion_verification') { const a=String(p.verifierOneId||''),b=String(p.verifierTwoId||''); if(!a||!b)return fail('2001','核对人不能为空'); if(a===b)return fail('2005','核对人必须不同'); if(ctx.activeUserExists&&(!ctx.activeUserExists(a)||!ctx.activeUserExists(b)))return fail('3003','核对人非active'); }
  if (entityType==='rescue_action') { const id=String(p.rescueEventLocalId||''); if(!id)return fail('2001','缺少rescueEventLocalId'); if(ctx.rescueEventExists&&!ctx.rescueEventExists(id))return fail('3003','rescue_event不存在'); }
  return ok();
}
