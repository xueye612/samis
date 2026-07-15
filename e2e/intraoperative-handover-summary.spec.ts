import { expect, test } from '@playwright/test';
import type { Page, Request } from '@playwright/test';
import { cleanupP09Fixture, generateP09OperationId, setupP09Fixture, statusP09Fixture } from './helpers/intraoperativeHandoverSummaryFixture';

const realEnabled = process.env.SAMIS_P09_E2E === '1';
const username = process.env.SAMIS_E2E_USERNAME;
const password = process.env.SAMIS_E2E_PASSWORD;
const ok = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: 'ok', data }) });
const form = (request: Request) => new URLSearchParams(request.postData() ?? '');
const operationCase = { operationId:'OP-P09-WEB-1',patientNo:'ZY-P09-1',patientName:'P09合成患者',gender:'女',age:42,departmentName:'普外科',preoperativeDiagnosisName:'胆囊结石',operationName:'腹腔镜胆囊切除术',roomName:'OR-03',plannedStartTime:'2026-07-20 09:00:00' };

interface State {
  permissions: string[];
  handover: any | null;
  handoverHistory: any[];
  summary: any | null;
  summaryHistory: any[];
  record: any | null;
  devices: any[];
  alerts: any[];
  posts: Array<{ path: string; fields: URLSearchParams }>;
  gets: Record<string, number>;
}

function makeState(permissions = ['*']): State {
  return { permissions, handover:null, handoverHistory:[], summary:null, summaryHistory:[], record:null, devices:[], alerts:[], posts:[], gets:{} };
}

async function seed(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('samis_token','p09-e2e-token');sessionStorage.setItem('samis_authorization','Bearer p09-e2e-token');
    sessionStorage.setItem('samis_room','OR-03');sessionStorage.setItem('samis_room_group','ANES');
    sessionStorage.setItem('samis_user_profile',JSON.stringify({userId:'OUT-1',displayName:'P09验收医师'}));
  });
}

function parse(value: string | null): any { if (value === null) return null; try { return JSON.parse(value); } catch { return value; } }
function generatedPayload() { return { operationId:operationCase.operationId,generatedAt:'2026-07-15 20:00:00',source:{recordRevisionId:'REV-P09-1',recordContentHash:'a'.repeat(64)},case:{diagnosis:'胆囊结石',surgeryName:'腹腔镜胆囊切除术',anesthesiaMethod:'全身麻醉',asa:'II'},timeline:{recordStart:'2026-07-15 08:00:00',recordEnd:'2026-07-15 10:00:00',anesthesiaStart:'2026-07-15 08:10:00',anesthesiaEnd:'2026-07-15 09:50:00',surgeryStart:'2026-07-15 08:30:00',surgeryEnd:'2026-07-15 09:30:00',anesthesiaDurationMinutes:100,surgeryDurationMinutes:60},airway:[{action:'intubation'}],ventilation:[{mode:'VCV'}],monitoring:{HR:{min:60,max:98,unit:'bpm'}},medications:[{drugName:'丙泊酚'}],fluids:[{fluidName:'乳酸林格'}],transfusions:[],ioRecords:[{ioType:'urine'}],labAbnormalities:[{itemName:'血红蛋白'}],events:[{eventName:'麻醉开始'}],rescueEvents:[{level:'moderate'}],recovery:{status:'completed',inAt:'2026-07-15 10:00:00',outAt:'2026-07-15 10:30:00'},outcome:{postoperativeDestination:'PACU'} }; }

async function install(page: Page, state: State) {
  await page.route('**/api-samis/pc/v1/**', async (route) => {
    const request=route.request();const url=new URL(request.url());const path=url.pathname;const method=request.method();
    if(method==='GET')state.gets[path]=(state.gets[path]??0)+1;if(method==='POST')state.posts.push({path,fields:form(request)});
    if(path.endsWith('/auth/myPermissions')){await route.fulfill(ok({permissions:state.permissions,role:state.permissions.length?'admin':'viewer'}));return;}
    if(path.endsWith('/preoperative/requestList')){await route.fulfill(ok({list:[{id:0,operationId:operationCase.operationId,status:'已排班',version:0,operationCase}],total:1}));return;}
    if(path.endsWith('/anesthesiaRecord/getRecordDetail')){await route.fulfill(ok({operationId:operationCase.operationId,record:state.record}));return;}
    if(path.endsWith('/anesthesiaDeviceV2/registryList')){await route.fulfill(ok({list:state.devices,total:state.devices.length}));return;}
    if(path.endsWith('/anesthesiaDeviceV2/alertList')){await route.fulfill(ok({list:state.alerts,total:state.alerts.length}));return;}
    if(path.endsWith('/anesthesiaHandover/detail')){await route.fulfill(ok({operationId:operationCase.operationId,operationCase,currentResponsibleDoctor:state.handover?.status==='accepted'?{doctorId:'IN-1',doctorName:'接班医生',acceptedAt:'2026-07-15 20:03:00'}:null,activeHandover:state.handover&&['draft','submitted'].includes(state.handover.status)?state.handover:null,history:state.handoverHistory}));return;}
    if(path.endsWith('/anesthesiaHandover/saveDraft')){const f=form(request),next=Number(state.handover?.version??0)+1;state.handover={handoverId:'HO-P09',handoverVersionId:'HOV-P09',operationId:operationCase.operationId,version:next,handoverType:f.get('handoverType'),status:'draft',outgoingDoctorId:'OUT-1',outgoingDoctorName:'交班医生',incomingDoctorId:f.get('incomingDoctorId'),incomingDoctorName:'接班医生',handoverAt:null,acceptedAt:null,priorityNotes:f.get('priorityNotes'),specialNotes:f.get('specialNotes'),emergencyReason:f.get('emergencyReason'),responsibilities:parse(f.get('responsibilities'))??[],activeProblems:parse(f.get('activeProblems'))??[],riskItems:parse(f.get('riskItems'))??[],equipment:parse(f.get('equipment'))??[],lines:parse(f.get('lines'))??[],activeMedications:parse(f.get('activeMedications'))??[],pendingTasks:parse(f.get('pendingTasks'))??[],checks:parse(f.get('checks'))??[],clinicalSnapshot:null,cancelReason:null,createdAt:'2026-07-15 20:00:00',updatedAt:'2026-07-15 20:00:00'};await route.fulfill(ok(state.handover));return;}
    if(path.endsWith('/anesthesiaHandover/submit')){state.handover={...state.handover,status:'submitted',version:Number(state.handover.version)+1,handoverAt:'2026-07-15 20:02:00',clinicalSnapshot:{snapshotAt:'2026-07-15 20:02:00',airway:[{}],ventilation:[{}],activeMedications:[{}],io:[{}],latestVitals:[{}],rescueEvents:[{}]}};state.handoverHistory=[state.handover];await route.fulfill(ok(state.handover));return;}
    if(path.endsWith('/anesthesiaHandover/accept')){state.handover={...state.handover,status:'accepted',version:Number(state.handover.version)+1,acceptedAt:'2026-07-15 20:03:00'};state.handoverHistory=[state.handover];await route.fulfill(ok(state.handover));return;}
    if(path.endsWith('/anesthesiaSummary/detail')){await route.fulfill(ok({operationId:operationCase.operationId,operationCase,currentSummary:state.summary,history:state.summaryHistory}));return;}
    if(path.endsWith('/anesthesiaSummary/generate')){const f=form(request);state.summary=state.summary?{...state.summary,version:Number(state.summary.version)+1,generatedPayload:generatedPayload(),updatedAt:'2026-07-15 20:10:00'}:{summaryId:'SUM-P09',summaryVersionId:'SUMV-P09-1',operationId:operationCase.operationId,version:1,status:'draft',generatedPayload:generatedPayload(),doctorSupplement:{},effectRating:null,intraoperativeNotes:null,recoveryNotes:null,complicationSummary:null,postoperativeDestination:null,submittedAt:null,signedAt:null,printedAt:null,archivedAt:null,cancelledAt:null,cancelReason:null,sourceRecordRevisionId:'REV-P09-1',sourceContentHash:'a'.repeat(64),contentHash:null,signatureDocumentId:null,revisionReason:null,createdAt:'2026-07-15 20:05:00',updatedAt:'2026-07-15 20:05:00'};expect(f.has('expectedVersion')).toBe(true);await route.fulfill(ok(state.summary));return;}
    if(path.endsWith('/anesthesiaSummary/saveDraft')){const f=form(request);const doctor=parse(f.get('doctorSupplement'))??{};state.summary={...state.summary,version:Number(state.summary.version)+1,doctorSupplement:doctor,effectRating:doctor.effectRating??null,intraoperativeNotes:doctor.intraoperativeNotes??null,recoveryNotes:doctor.recoveryNotes??null,complicationSummary:doctor.complicationSummary??null,postoperativeDestination:doctor.postoperativeDestination??null};await route.fulfill(ok(state.summary));return;}
    if(path.endsWith('/anesthesiaSummary/submit')){state.summary={...state.summary,status:'submitted',version:Number(state.summary.version)+1,contentHash:'b'.repeat(64),submittedAt:'2026-07-15 20:11:00'};state.summaryHistory=[state.summary,...state.summaryHistory];await route.fulfill(ok(state.summary));return;}
    if(path.endsWith('/anesthesiaSummary/createRevision')){const f=form(request);state.summary={...state.summary,summaryVersionId:'SUMV-P09-2',status:'draft',version:Number(state.summary.version)+1,revisionReason:f.get('reason'),contentHash:null,submittedAt:null,signedAt:null,printedAt:null,archivedAt:null};await route.fulfill(ok(state.summary));return;}
    if(path.endsWith('/anesthesiaSummary/sign')){const f=form(request);state.summary={...state.summary,status:'signed',version:Number(state.summary.version)+1,signatureDocumentId:f.get('signatureDocumentId'),signedAt:'2026-07-15 20:12:00'};await route.fulfill(ok(state.summary));return;}
    if(path.endsWith('/anesthesiaSummary/markPrinted')){state.summary={...state.summary,version:Number(state.summary.version)+1,printedAt:'2026-07-15 20:13:00'};await route.fulfill(ok(state.summary));return;}
    if(path.endsWith('/anesthesiaSummary/archive')){state.summary={...state.summary,status:'archived',version:Number(state.summary.version)+1,archivedAt:'2026-07-15 20:14:00'};state.summaryHistory=[state.summary,...state.summaryHistory];await route.fulfill(ok(state.summary));return;}
    await route.fulfill(ok({list:[]}));
  });
}

const item=(page:Page,label:string)=>page.locator('.arco-form-item').filter({hasText:label}).first();

test.describe('P09 术中、交班与麻醉小结验收',()=>{
  test('真实 empty 与设备 empty 不回落本地病例或演示设备',async({page})=>{const s=makeState();await seed(page);await install(page,s);await page.goto('/surgery/medications');await expect(page.getByText('暂无真实用药记录')).toBeVisible();await expect(page.getByText(/未命名|测试患者/)).toHaveCount(0);await page.goto('/monitor/devices');await expect(page.getByText('暂无设备注册数据')).toBeVisible();await expect(page.getByText('监护仪-01',{exact:true})).toHaveCount(0);await expect(page.locator('.arco-table-row')).toHaveCount(0);});

  test('无权限时交班和小结写动作隐藏且零写请求',async({page})=>{const s=makeState([]);await seed(page);await install(page,s);await page.goto('/surgery/handover');await expect(page.getByText('P09合成患者').first()).toBeVisible();await expect(page.getByRole('button',{name:'保存草稿'})).toHaveCount(0);await page.goto('/surgery/summary');await expect(page.getByRole('button',{name:'生成小结草稿'})).toHaveCount(0);expect(s.posts.filter(v=>/anesthesia(Handover|Summary)/.test(v.path))).toHaveLength(0);});

  test('丰富交班按版本保存、提交快照并由指定接班人确认',async({page})=>{const s=makeState();await seed(page);await install(page,s);await page.goto('/surgery/handover');await item(page,'接班医师工号').locator('input').fill('IN-1');await item(page,'当前问题').locator('textarea').fill('血压波动');await item(page,'风险').locator('textarea').fill('困难气道');await item(page,'设备状态').locator('textarea').fill('监护仪正常');await item(page,'管路状态').locator('textarea').fill('左上肢静脉通路');await item(page,'持续用药').locator('textarea').fill('丙泊酚 10ml/h');await item(page,'待办').locator('textarea').fill('复查血气');await page.getByRole('button',{name:'提交交班'}).click();await expect(page.getByText(/提交快照：气道 1 条/)).toBeVisible();await page.getByRole('button',{name:'指定接班人确认'}).click();await page.getByRole('button',{name:'历史版本'}).click();await expect(page.locator('.arco-drawer').getByText('accepted')).toBeVisible();const writes=s.posts.filter(v=>v.path.includes('/anesthesiaHandover/'));expect(writes.map(v=>v.fields.get('expectedVersion'))).toEqual(['0','1','2']);expect(JSON.parse(writes[0].fields.get('activeProblems')||'[]')[0].description).toBe('血压波动');expect(JSON.parse(writes[0].fields.get('equipment')||'[]')[0].name).toBe('监护仪正常');expect(s.gets['/api-samis/pc/v1/anesthesiaHandover/detail']).toBeGreaterThanOrEqual(4);});

  test('小结自动区与医生区分离，重新生成保留补充并完成修订签名归档',async({page})=>{const s=makeState();await seed(page);await install(page,s);await page.goto('/surgery/summary');await page.getByRole('button',{name:'生成小结草稿'}).click();await expect(page.getByText('胆囊结石').first()).toBeVisible();await expect(page.getByText('全身麻醉').first()).toBeVisible();await item(page,'术中评价').locator('textarea').fill('术中平稳');await item(page,'其他说明').locator('textarea').fill('保留医生意见');await page.getByRole('button',{name:'保存医生补充'}).click();await page.getByRole('button',{name:'重新聚合自动区'}).click();await expect(item(page,'其他说明').locator('textarea')).toHaveValue('保留医生意见');await page.getByRole('button',{name:'提交并冻结'}).click();const frozenHash=s.summary.contentHash;await page.getByPlaceholder('修订原因').fill('补充术中处置');await page.getByRole('button',{name:'创建修订草稿'}).click();await expect(item(page,'其他说明').locator('textarea')).toHaveValue('保留医生意见');await page.getByRole('button',{name:'提交并冻结'}).click();await page.getByPlaceholder('内部签名引用').fill('DOC-P09-INTERNAL');await page.getByRole('button',{name:'记录内部签名'}).click();await page.getByRole('button',{name:'标记已打印'}).click();await page.getByRole('button',{name:'归档版本'}).click();await expect(page.getByText('已归档',{exact:true})).toBeVisible();const writes=s.posts.filter(v=>v.path.includes('/anesthesiaSummary/'));expect(writes.map(v=>v.fields.get('expectedVersion'))).toEqual(['0','1','2','3','4','5','6','7','8']);expect(JSON.parse(writes[1].fields.get('doctorSupplement')||'{}').otherNotes).toBe('保留医生意见');expect(frozenHash).toBe('b'.repeat(64));expect(s.summary.doctorSupplement.otherNotes).toBe('保留医生意见');expect(s.gets['/api-samis/pc/v1/anesthesiaSummary/detail']).toBeGreaterThanOrEqual(10);});

  test('真实凭据完整生命周期与 finally 清理（opt-in）',async({page})=>{test.skip(!realEnabled||!username||!password,'requires SAMIS_P09_E2E=1 and credentials');if(!username||!password)return;const id=generateP09OperationId();let setup=false;try{await page.goto('/login');await page.locator('input').first().fill(username);await page.locator('input[type="password"]').fill(password);await page.getByRole('button',{name:'登录'}).click();await expect(page).not.toHaveURL(/\/login/);await setupP09Fixture(id);setup=true;await page.goto('/surgery/handover');await page.waitForLoadState('networkidle');}finally{if(setup)await cleanupP09Fixture(id);expect((await statusP09Fixture(id)).status).toBe('absent');}});
});
