import { buildSamisError, buildSamisSuccess } from '@/api/samisResponse';
import type { SamisApiResponse } from '@/api/samisResponse';
import type { PushBatchRequest, PushBatchResponse, PushBatchResultItem } from '@/api/anesthesiaSync';
import dayjs from 'dayjs';
import { seedDrugDict, seedFluidBloodDict, seedVitalSignDict, seedMethodCategories } from '@/mock/configSeed';
import { anesthesiaCases, pacuPatients as mockPacuPatients } from '@/mock/anesthesiaCases';
import { drugDictItemToApi } from '@/services/drugDictMapper';
import { buildDrugRecommendFromDict } from '@/services/drugDictRecommend';
import { SPECIAL_DRUG_CATEGORY_OPTIONS } from '@/types/drugDict';
import { qualityIndicators } from '@/config/qualityIndicators';

const serverIdCounter = { value: 10000 };

interface MockServerEntity {
  entityType: string;
  localId: string;
  serverId: number;
  syncVersion: number;
  payload: unknown;
  deletedAt?: string;
  isCorrected?: boolean;
  collectTime?: string;
}

const serverEntityRegistry = new Map<string, MockServerEntity>();

const mockAnesthesiaPlans = new Map<string, Record<string, unknown>>();
const mockAnesthesiaHandovers = new Map<string, Record<string, unknown>>();
const mockAnesthesiaSummaries = new Map<string, Record<string, unknown>>();
const mockClinicalConfigState = new Map<string, string>();
const DEVICE_REALTIME_SOURCE_STORAGE_KEY = 'samis.anesthesia.deviceRealtimeDataSource';

function readMockClinicalConfig(key: string, scope: string): string | null {
  const stored = mockClinicalConfigState.get(`${key}:${scope}`);
  if (stored !== undefined) return stored;
  if (
    key === 'device_realtime_data_source'
    && scope === 'global'
    && typeof localStorage !== 'undefined'
  ) {
    const cached = localStorage.getItem(DEVICE_REALTIME_SOURCE_STORAGE_KEY);
    if (cached === 'simulation' || cached === 'real') return cached;
  }
  return null;
}

interface MockPreoperativeAssessment {
  operationId: string;
  assessmentId: string;
  version: number;
  asaGrade: string | null;
  anesthesiaPlan: string | null;
  airwayAssessment: string | null;
  allergyHistory: string | null;
  pastAnesthesiaHistory: string | null;
  abnormalExamSummary: string | null;
  riskSummary: string | null;
  preMedicationAdvice: string | null;
  riskLevel: string | null;
  cardiopulmonaryJson: Record<string, unknown> | null;
  airwayJson: Record<string, unknown> | null;
  fastingJson: Record<string, unknown> | null;
  dentitionJson: Record<string, unknown> | null;
  medicalHistoryJson: unknown[] | Record<string, unknown> | null;
  surgicalHistoryJson: unknown[] | null;
  medicationHistoryJson: unknown[] | null;
  systemAssessmentJson: Record<string, unknown> | null;
  examAbnormalitiesJson: unknown[] | null;
  riskFactorsJson: unknown[] | null;
  recommendationsJson: unknown[] | null;
  status: 'draft' | 'submitted' | 'cancelled';
  evaluatorId: string | null;
  evaluatorName: string | null;
  evaluatedAt: string | null;
  submittedAt: string | null;
  updatedAt: string | null;
}

const mockPreoperativeAssessmentState = new Map<string, MockPreoperativeAssessment>();
let mockPreoperativeAssessmentSequence = 1;

/** Mock PACU 内存态（从 mock 种子克隆，避免污染源数据）。 */
const mockPacuState = mockPacuPatients.map((p) => ({ ...p }));

/** Mock PACU 预约内存态（Slice 4b）。 */
interface MockPacuBooking {
  id: string;
  caseId: string;
  patientName: string | null;
  pacuRoomId: string | null;
  bedId: string | null;
  bookingTime: string;
  bookingDoctor: string | null;
  bookingType: string;
  status: string;
  remark: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}
const mockPacuBookingState: MockPacuBooking[] = anesthesiaCases.slice(0, 4).map((c, idx) => ({
  id: `bk-mock-${idx + 1}`,
  caseId: c.id,
  patientName: c.patientName,
  pacuRoomId: 'g-pacu',
  bedId: idx % 2 === 0 ? `A-0${idx + 1}` : null,
  bookingTime: dayjs().add(idx - 1, 'day').format('YYYY-MM-DD HH:mm:ss'),
  bookingDoctor: '张医师',
  bookingType: idx === 1 ? '紧急预约' : '常规预约',
  status: idx === 0 ? '已接收' : '待接收',
  remark: null,
  createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
}));
let mockBookingIdCounter = { value: 5000 };

/** Mock PACU 床位内存态（Slice 6c A）。 */
const mockBedState: Array<{
  id: number; roomId: string; bedNo: string; status: string;
  patientName: string | null; caseId: string | null;
  inTime: string | null; outTime: string | null;
  remark: string | null; createdAt: string; updatedAt: string;
}> = ['A-01', 'A-02', 'A-03', 'B-01', 'B-02'].map((no, idx) => ({
  id: idx + 1,
  roomId: no.startsWith('A') ? 'pacu-A' : 'pacu-B',
  bedNo: no,
  status: idx === 0 ? '占用' : idx === 4 ? '维护' : '空闲',
  patientName: idx === 0 ? '赵六' : null,
  caseId: idx === 0 ? 'case-pacu-A-01' : null,
  inTime: idx === 0 ? dayjs().subtract(30, 'minute').format('YYYY-MM-DD HH:mm:ss') : null,
  outTime: null,
  remark: null,
  createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
}));
let mockBedIdCounter = { value: 100 };

/** Mock 质控抽查内存态（Slice 6c B）。 */
interface MockQualityCheck {
  id: number; checkItem: string; standard: string | null;
  result: string; checker: string | null; checkDate: string | null;
  issueDesc: string | null; rectifyStatus: string;
  createdAt: string; updatedAt: string;
}
const mockQualityCheckState: MockQualityCheck[] = [
  {
    id: 1,
    checkItem: '术前访视记录完整性',
    standard: '择期手术 100% 覆盖',
    result: '合格',
    checker: '李质控',
    checkDate: dayjs().subtract(2, 'day').format('YYYY-MM-DD'),
    issueDesc: null,
    rectifyStatus: '已闭环',
    createdAt: dayjs().subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
    updatedAt: dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
  },
  {
    id: 2,
    checkItem: '麻醉知情同意书签署',
    standard: '入室前 100% 签署',
    result: '不合格',
    checker: '李质控',
    checkDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
    issueDesc: '2 例缺失',
    rectifyStatus: '待整改',
    createdAt: dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
    updatedAt: dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
  },
];
let mockQualityCheckIdCounter = { value: 100 };

/** Mock 术后随访内存态（Slice 5）。 */
interface MockFollowup {
  id: number;
  caseId: string;
  operationId: string | null;
  patientName: string;
  followupType: string;
  followTime: string;
  vasScore: number | null;
  nausea: boolean;
  headache: boolean;
  hoarseness: boolean;
  hoarsenessDurationHours: number | null;
  numbness: boolean;
  motorDisorder: boolean;
  awareness: boolean;
  respiratoryDepression: boolean;
  reintubation: boolean;
  transferredIcu: boolean;
  newComa: boolean;
  neuroDurationHours: number | null;
  death24h: boolean;
  deathTime: string | null;
  advice: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}
let mockFollowupIdCounter = { value: 7000 };
const mockFollowupState: MockFollowup[] = anesthesiaCases
  .filter((c) => c.postoperativeAnalgesia)
  .slice(0, 3)
  .map((c, idx) => ({
    id: mockFollowupIdCounter.value + idx + 1,
    caseId: c.id,
    operationId: c.id,
    patientName: c.patientName,
    followupType: idx === 2 ? '全麻术后随访' : '术后镇痛随访',
    followTime: dayjs().subtract(idx, 'day').format('YYYY-MM-DD HH:mm:ss'),
    vasScore: [2, 4, 1][idx] ?? 3,
    nausea: idx === 1,
    headache: false,
    hoarseness: idx === 2,
    hoarsenessDurationHours: idx === 2 ? 8 : null,
    numbness: false,
    motorDisorder: false,
    awareness: false,
    respiratoryDepression: false,
    reintubation: false,
    transferredIcu: idx === 2,
    newComa: false,
    neuroDurationHours: null,
    death24h: false,
    deathTime: null,
    advice: '继续当前镇痛方案，注意随访。',
    createdAt: dayjs().subtract(idx, 'day').format('YYYY-MM-DD HH:mm:ss'),
    updatedAt: dayjs().subtract(idx, 'day').format('YYYY-MM-DD HH:mm:ss'),
  }));

/** Mock 并发症上报内存态（Slice 5）。 */
interface MockComplication {
  id: number;
  caseId: string;
  operationId: string | null;
  patientName: string;
  type: string;
  severity: string;
  stage: string | null;
  symptoms: string | null;
  treatment: string | null;
  outcome: string | null;
  reportTime: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
}
let mockComplicationIdCounter = { value: 8000 };
const mockComplicationState: MockComplication[] = [
  {
    id: mockComplicationIdCounter.value + 1,
    caseId: anesthesiaCases[2]?.id ?? 'case-or03',
    operationId: anesthesiaCases[2]?.id ?? 'case-or03',
    patientName: anesthesiaCases[2]?.patientName ?? '患者',
    type: '低体温',
    severity: '中度',
    stage: '术中',
    symptoms: '术中体温35.6℃',
    treatment: '升温毯+预热输液',
    outcome: '体温恢复',
    reportTime: dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
    status: '已提交',
    createdAt: dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
    updatedAt: dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
  },
];

/** Mock 镇痛/非计划病例聚合（Slice 5）：从 anesthesiaCases 派生 case 摘要行。 */
function caseToSummary(c: (typeof anesthesiaCases)[number]) {
  return {
    operationId: c.id,
    caseId: c.id,
    patientName: c.patientName,
    gender: c.gender,
    age: c.age,
    department: c.department,
    diagnosis: c.diagnosis,
    surgeryName: c.surgeryName,
    surgeon: c.surgeon,
    anesthesiaMethod: c.anesthesiaMethod,
    room: c.room,
    recordStatus: c.recordStatus ?? null,
    postoperativeAnalgesia: Boolean(c.postoperativeAnalgesia),
    transferIcuPlanned: Boolean(c.transferIcuPlanned),
    reintubation: false,
    transferTo: c.transferTo ?? null,
    recordEndTime: c.leaveRoomTime ?? null,
  };
}

// ============ Slice 7 术前管理 mock 内存态（从 anesthesiaCases 派生） ============
interface MockPreopRequest {
  id: number; operationId: string; patientName: string | null; department: string | null;
  surgeryName: string | null; surgeon: string | null; urgency: string; requestDate: string | null;
  status: string; receivedAt: string | null; receivedBy: string | null; remark: string | null;
  createdAt: string; updatedAt: string;
}
interface MockPreopConsultation {
  id: number; caseId: string; operationId: string | null; patientName: string | null;
  requestDept: string | null; consultDate: string | null; consultant: string | null;
  opinion: string | null; status: string; createdAt: string; updatedAt: string;
}
interface MockPreopExamReview {
  id: number; caseId: string; operationId: string | null; patientName: string | null;
  labItems: string | null; imagingItems: string | null; reviewResult: string;
  reviewer: string | null; reviewDate: string | null; createdAt: string; updatedAt: string;
}
interface MockPreopConsent {
  id: number; caseId: string; operationId: string | null; patientName: string | null;
  surgeryName: string | null; anesthesiaMethod: string | null; surgeryDate: string | null;
  commonRisks: boolean; severeRisks: boolean; specialRisks: boolean; planAccepted: boolean;
  questionAnswered: boolean; patientSigned: boolean; familySigned: boolean; doctorSigned: boolean;
  signedAt: string | null; status: string; createdAt: string; updatedAt: string;
}
interface MockPreopSafetyCheck {
  id: number; caseId: string; operationId: string | null; patientName: string | null;
  signInComplete: boolean; timeOutComplete: boolean; signOutComplete: boolean;
  checker: string | null; checkDate: string | null; status: string; createdAt: string; updatedAt: string;
}

const preopNow = () => dayjs().format('YYYY-MM-DD HH:mm:ss');
let mockPreopRequestIdCounter = { value: 9000 };
const mockPreopRequestState: MockPreopRequest[] = anesthesiaCases.slice(0, 5).map((c, idx) => ({
  id: mockPreopRequestIdCounter.value + idx + 1,
  operationId: c.id,
  patientName: c.patientName,
  department: c.department ?? null,
  surgeryName: c.surgeryName,
  surgeon: c.surgeon ?? null,
  urgency: c.urgency === '急诊' ? '急诊' : '择期',
  requestDate: operationCaseDate(c),
  status: idx === 0 ? '已排班' : idx === 4 ? '已取消' : '待接收',
  receivedAt: idx === 0 ? preopNow() : null,
  receivedBy: idx === 0 ? '演示用户' : null,
  remark: null,
  createdAt: preopNow(),
  updatedAt: preopNow(),
}));

let mockPreopConsultationIdCounter = { value: 9100 };
const mockPreopConsultationState: MockPreopConsultation[] = anesthesiaCases.slice(0, 3).map((c, idx) => ({
  id: mockPreopConsultationIdCounter.value + idx + 1,
  caseId: c.id,
  operationId: c.id,
  patientName: c.patientName,
  requestDept: c.department ?? null,
  consultDate: dayjs().subtract(idx, 'day').format('YYYY-MM-DD HH:mm:ss'),
  consultant: idx === 0 ? '张麻醉' : '李麻醉',
  opinion: 'ASA 评估可耐受麻醉，注意术前禁食。',
  status: idx === 0 ? '已完成' : '待会诊',
  createdAt: preopNow(),
  updatedAt: preopNow(),
}));

let mockPreopExamReviewIdCounter = { value: 9200 };
const mockPreopExamReviewState: MockPreopExamReview[] = anesthesiaCases.slice(0, 4).map((c, idx) => ({
  id: mockPreopExamReviewIdCounter.value + idx + 1,
  caseId: c.id,
  operationId: c.id,
  patientName: c.patientName,
  labItems: '血常规、凝血、肝肾功能',
  imagingItems: idx % 2 === 0 ? '胸片、心电图' : '心电图',
  reviewResult: (['通过', '待补检', '通过', '异常'] as const)[idx] ?? '通过',
  reviewer: '王检验',
  reviewDate: operationCaseDate(c),
  createdAt: preopNow(),
  updatedAt: preopNow(),
}));

let mockPreopConsentIdCounter = { value: 9300 };
const mockPreopConsentState: MockPreopConsent[] = anesthesiaCases.slice(0, 3).map((c, idx) => ({
  id: mockPreopConsentIdCounter.value + idx + 1,
  caseId: c.id,
  operationId: c.id,
  patientName: c.patientName,
  surgeryName: c.surgeryName,
  anesthesiaMethod: c.anesthesiaMethod,
  surgeryDate: operationCaseDate(c),
  commonRisks: true,
  severeRisks: idx === 0,
  specialRisks: false,
  planAccepted: true,
  questionAnswered: true,
  patientSigned: idx === 0,
  familySigned: idx === 0,
  doctorSigned: idx === 0,
  signedAt: idx === 0 ? preopNow() : null,
  status: idx === 0 ? '已提交' : '草稿',
  createdAt: preopNow(),
  updatedAt: preopNow(),
}));

let mockPreopSafetyCheckIdCounter = { value: 9400 };
const mockPreopSafetyCheckState: MockPreopSafetyCheck[] = anesthesiaCases.slice(0, 3).map((c, idx) => ({
  id: mockPreopSafetyCheckIdCounter.value + idx + 1,
  caseId: c.id,
  operationId: c.id,
  patientName: c.patientName,
  signInComplete: true,
  timeOutComplete: idx === 0,
  signOutComplete: idx === 0,
  checker: '陈核查',
  checkDate: operationCaseDate(c),
  status: idx === 0 ? '已完成' : '未完成',
  createdAt: preopNow(),
  updatedAt: preopNow(),
}));


/** 前端 PacuPatient → 后端 anes_pacu_record 行（camelCase）。 */
function pacuPatientToApiRow(p: (typeof mockPacuPatients)[number]) {
  const inTime = dayjs(p.inTime);
  return {
    id: Number(String(p.id).replace(/\D/g, '')) || 0,
    caseId: p.caseId,
    patientName: p.patientName,
    room: p.room,
    bedNo: null,
    pacuInTime: inTime.isValid() ? inTime.format('YYYY-MM-DD HH:mm:ss') : p.inTime,
    pacuOutTime: p.outTime ? dayjs(p.outTime).format('YYYY-MM-DD HH:mm:ss') : null,
    firstTemp: p.firstTemperature ?? null,
    hr: p.HR || null,
    bp: p.BP || null,
    spo2: p.SpO2 || null,
    rr: p.RR || null,
    aldreteIn: p.aldrete ?? 0,
    aldreteOut: null,
    vasScore: p.vas ?? 0,
    nauseaVomiting: p.nausea ?? false,
    shivering: p.shivering ?? false,
    agitation: p.agitation ?? false,
    reintubation: p.reintubation ?? false,
    status: p.status,
    outDestination: p.transferTo ?? null,
    handoverNurseId: p.handover || null,
    remark: null,
    createdAt: inTime.isValid() ? inTime.format('YYYY-MM-DD HH:mm:ss') : null,
    updatedAt: inTime.isValid() ? inTime.format('YYYY-MM-DD HH:mm:ss') : null,
  };
}

function entityKey(entityType: string, localId: string) {
  return `${entityType}:${localId}`;
}

function nextServerId() {
  serverIdCounter.value += 1;
  return serverIdCounter.value;
}

function parseBody<T>(init?: RequestInit): T {
  const raw = String(init?.body ?? '');
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    const params = new URLSearchParams(raw);
    const obj: Record<string, unknown> = {};
    params.forEach((value, key) => {
      if (/^[\[{]/.test(value.trim())) {
        try {
          obj[key] = JSON.parse(value);
          return;
        } catch {
          // keep the original form value
        }
      }
      obj[key] = value;
    });
    if (typeof obj.data === 'string') {
      try {
        obj.data = JSON.parse(obj.data);
      } catch {
        // keep string
      }
    }
    if (typeof obj.items === 'string') {
      try {
        obj.items = JSON.parse(obj.items);
      } catch {
        // keep string
      }
    }
    return obj as T;
  }
}

function getPayloadField(payload: unknown, key: string) {
  if (!payload || typeof payload !== 'object') return undefined;
  return (payload as Record<string, unknown>)[key];
}

function joinDisplayValue(value: unknown, fallback = '') {
  if (Array.isArray(value)) return value.join('、');
  return String(value ?? fallback);
}

function caseToOperationRow(item: (typeof anesthesiaCases)[0]) {
  const scheduledStart = item.scheduledStart ?? item.plannedStart;
  return {
    operationId: item.id,
    OPERATIONID: item.id,
    patientName: item.patientName,
    patientNumber: item.patientId ?? item.id,
    room: item.room,
    roomName: item.roomName ?? item.room,
    roomId: item.roomId ?? item.room,
    numberOfStations: item.sequence,
    surgeryName: item.surgeryName,
    diagnosis: item.diagnosis,
    surgeon: item.surgeon,
    anesthesiologist: item.anesthesiologist,
    anesthesiaMethod: item.anesthesiaMethod,
    asa: item.asa,
    gender: item.gender,
    age: item.age,
    department: item.department,
    operationDate: dayjs(scheduledStart).format('YYYY-MM-DD'),
    scheduledStart,
    scheduledEnd: item.scheduledEnd,
    plannedStart: item.plannedStart,
    urgency: item.urgency,
    status: item.status,
    circulatingNurse: joinDisplayValue(item.circulatingNurses, item.anesthesiaNurse),
    scrubNurse: joinDisplayValue(item.scrubNurses),
  };
}

function findCaseByOperationId(operationId: string) {
  return anesthesiaCases.find((c) => c.id === operationId);
}

function getSearchParams(path: string) {
  return new URL(path, 'http://local').searchParams;
}

// 关键时间 mock 内存态（仅 dev 验证用，模拟后端闭环：审计追加 + 原始保护 + 版本递增）。
const mockTimelineNodes = new Map<string, Array<{ nodeCode: string; nodeName: string; eventTime: string | null; originalEventTime: string | null; source: string | null; recorded: boolean }>>();
const mockTimelineVersion = new Map<string, number>();
const NODE_ORDER: Record<string, number> = { 'room-in': 10, 'anes-start': 20, 'induction': 30, 'intubation': 40, 'puncture': 40, 'positioning': 40, 'sedation-start': 40, 'local': 40, 'catheter': 50, 'plane': 55, 'block-assess': 55, 'surgery-start': 60, 'surgery-end': 70, 'extubation': 80, 'anes-end': 85, 'leave-room': 90 };
const HULI_NODES = ['room-in', 'leave-room'];
function handleTimelineNodeGet(op: string) {
  const list = mockTimelineNodes.get(op) ?? [];
  return Object.entries(NODE_ORDER).map(([code, order]) => {
    const ev = list.find((n) => n.nodeCode === code);
    return { nodeCode: code, nodeName: ev?.nodeName ?? code, order, eventTime: ev?.eventTime ?? null, originalEventTime: ev?.originalEventTime ?? null, source: ev?.source ?? null, isHuliSource: HULI_NODES.includes(code), recorded: Boolean(ev?.eventTime) };
  }).sort((a, b) => a.order - b.order);
}
function handleTimelineNodeSave(body: { operationId: string; nodeCode: string; nodeName?: string; newTime: string | null; reason?: string; timelineOrderOverride?: boolean; source?: string; expectedVersion: number }) {
  const op = body.operationId;
  const list = mockTimelineNodes.get(op) ?? [];
  const ver = (mockTimelineVersion.get(op) ?? 0) + 1;
  mockTimelineVersion.set(op, ver);
  const existing = list.find((n) => n.nodeCode === body.nodeCode);
  const isHuli = HULI_NODES.includes(body.nodeCode);
  if (body.newTime === null || body.newTime === undefined || body.newTime === '') {
    if (existing) { existing.eventTime = null; existing.recorded = false; }
  } else {
    if (existing) {
      if (isHuli && !existing.originalEventTime && existing.eventTime) existing.originalEventTime = existing.eventTime;
      existing.eventTime = body.newTime; existing.source = body.source ?? '人工录入'; existing.recorded = true;
    } else {
      list.push({ nodeCode: body.nodeCode, nodeName: body.nodeName ?? body.nodeCode, eventTime: body.newTime, originalEventTime: null, source: body.source ?? '人工录入', recorded: true });
    }
  }
  mockTimelineNodes.set(op, list);
  const updated = list.find((n) => n.nodeCode === body.nodeCode) ?? null;
  return { operationId: op, syncVersion: ver, nodeCode: body.nodeCode, changed: true, eventTime: updated?.eventTime ?? null, originalEventTime: updated?.originalEventTime ?? null, source: updated?.source ?? null, nodes: handleTimelineNodeGet(op) };
}


interface MockRoomDeviceConfig {
  configId: number;
  roomId: number;
  roomCode: string;
  roomName: string;
  sourceDeviceId: number;
  deviceCode: string;
  deviceModel: string;
  deviceName: string | null;
  deviceType: string;
  deviceRole: 'primary' | 'secondary';
  centralDeviceNo: string;
  enabled: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  changeReason: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
const mockRoomDeviceConfigSeed: MockRoomDeviceConfig[] = [
  { configId: 1, roomId: 1, roomCode: 'OR-01', roomName: '1号手术间', sourceDeviceId: 11, deviceCode: 'VENT-OR-01', deviceModel: 'A9500', deviceName: '1号呼吸机', deviceType: 'ventilator', deviceRole: 'primary', centralDeviceNo: 'CENTRAL-VENT-01', enabled: true, effectiveFrom: '2026-07-01 08:00:00', effectiveTo: null, changeReason: '初始配置', createdBy: 'mock', createdAt: '2026-07-01 08:00:00', updatedAt: '2026-07-20 09:00:00' },
];
const mockDeviceCandidates = [
  { deviceId: 11, deviceCode: 'VENT-OR-01', deviceModel: 'A9500', deviceName: '1号呼吸机', huliDeviceType: 'ventilator', status: 'enabled', enabled: true, readOnly: true as const, sourceSystem: 'HULI' as const },
  { deviceId: 12, deviceCode: 'VENT-OR-02', deviceModel: 'B730', deviceName: '2号呼吸机', huliDeviceType: 'ventilator', status: 'enabled', enabled: true, readOnly: true as const, sourceSystem: 'HULI' as const },
  { deviceId: 13, deviceCode: 'MON-OR-01', deviceModel: 'M9000', deviceName: '1号监护仪', huliDeviceType: 'monitor', status: 'enabled', enabled: true, readOnly: true as const, sourceSystem: 'HULI' as const },
  { deviceId: 14, deviceCode: 'VENT-NEW', deviceModel: 'C880', deviceName: '新呼吸机', huliDeviceType: 'ventilator', status: 'enabled', enabled: true, readOnly: true as const, sourceSystem: 'HULI' as const },
];
const mockRooms = [
  { roomId: 1, roomCode: 'OR-01', roomName: '1号手术间' },
  { roomId: 2, roomCode: 'OR-02', roomName: '2号手术间' },
  { roomId: 3, roomCode: 'OR-03', roomName: '3号手术间' },
];
const roomDeviceConfigMock = {
  list() {
    const activeByRoom = new Map<number, MockRoomDeviceConfig[]>();
    for (const cfg of mockRoomDeviceConfigSeed.filter((c) => c.enabled && !c.effectiveTo)) {
      (activeByRoom.get(cfg.roomId) ?? activeByRoom.set(cfg.roomId, []).get(cfg.roomId)!).push(cfg);
    }
    const list = mockRooms.map((room) => {
      const configs = activeByRoom.get(room.roomId) ?? [];
      const primaryVent = configs.find((c) => c.deviceType === 'ventilator' && c.deviceRole === 'primary') ?? null;
      const conflictCount = configs.filter((c) => c.deviceRole === 'primary').length > 1 ? 1 : 0;
      return {
        roomId: room.roomId, roomCode: room.roomCode, roomName: room.roomName,
        hasPrimaryVentilator: primaryVent !== null,
        configStatus: (conflictCount > 0 ? 'conflict' : primaryVent ? 'configured' : 'unconfigured') as 'configured' | 'unconfigured' | 'conflict',
        conflictCount,
        primaryDevice: primaryVent,
        secondaryDevices: configs.filter((c) => c.deviceRole === 'secondary'),
        anomalies: conflictCount > 0 ? ['存在多个启用主设备'] : ([] as string[]),
        lastChangedAt: configs.reduce<string | null>((m, c) => (!m || c.updatedAt > m ? c.updatedAt : m), null),
      };
    });
    return { list, total: list.length };
  },
  options(keyword?: string) {
    const active = mockRoomDeviceConfigSeed.filter((c) => c.enabled && !c.effectiveTo);
    const occupiedMap = new Map(active.map((c) => [c.sourceDeviceId, c.roomName]));
    const kw = (keyword ?? '').toLowerCase();
    const candidates = mockDeviceCandidates
      .filter((c) => !kw || c.deviceCode.toLowerCase().includes(kw) || c.deviceName.toLowerCase().includes(kw) || c.deviceModel.toLowerCase().includes(kw))
      .map((c) => {
        const occupied = occupiedMap.has(c.deviceId);
        const configuredRoomName = occupiedMap.get(c.deviceId) ?? null;
        const disabledReason = !c.enabled ? '设备已停用' : (occupied ? `已配置到：${configuredRoomName}` : null);
        return { ...c, occupied, configuredRoomName, selectable: disabledReason === null, disabledReason };
      });
    return { rooms: mockRooms, deviceTypes: ['ventilator', 'monitor', 'anesthesia_machine'], deviceCandidates: candidates, deviceCandidatesTotal: candidates.length };
  },
  save(body: { roomId: number; sourceDeviceId: number; deviceType: string; deviceRole: string; centralDeviceNo?: string; reason?: string }) {
    const device = mockDeviceCandidates.find((c) => c.deviceId === body.sourceDeviceId)!;
    const room = mockRooms.find((r) => r.roomId === body.roomId)!;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    // 同房间同类型 primary：停用旧 primary
    if (body.deviceRole === 'primary') {
      for (const c of mockRoomDeviceConfigSeed) {
        if (c.roomId === body.roomId && c.deviceType === body.deviceType && c.deviceRole === 'primary' && c.enabled && !c.effectiveTo && c.sourceDeviceId !== body.sourceDeviceId) {
          c.enabled = false; c.effectiveTo = now; c.changeReason = `更换主设备：${body.reason ?? ''}`;
        }
      }
    }
    const existing = mockRoomDeviceConfigSeed.find((c) => c.roomId === body.roomId && c.deviceType === body.deviceType && c.deviceRole === body.deviceRole && c.enabled && !c.effectiveTo && c.sourceDeviceId === body.sourceDeviceId);
    if (existing) { existing.centralDeviceNo = body.centralDeviceNo || existing.centralDeviceNo; existing.updatedAt = now; return existing; }
    const nextId = mockRoomDeviceConfigSeed.reduce((m, c) => Math.max(m, c.configId), 0) + 1;
    const created: MockRoomDeviceConfig = {
      configId: nextId, roomId: room.roomId, roomCode: room.roomCode, roomName: room.roomName,
      sourceDeviceId: device.deviceId, deviceCode: device.deviceCode, deviceModel: device.deviceModel, deviceName: device.deviceName,
      deviceType: body.deviceType, deviceRole: body.deviceRole as 'primary' | 'secondary',
      centralDeviceNo: body.centralDeviceNo || device.deviceCode, enabled: true, effectiveFrom: now, effectiveTo: null,
      changeReason: body.reason ?? '配置变更', createdBy: 'mock', createdAt: now, updatedAt: now,
    };
    mockRoomDeviceConfigSeed.push(created);
    return created;
  },
  remove(body: { configId: number; reason?: string }) {
    const cfg = mockRoomDeviceConfigSeed.find((c) => c.configId === body.configId);
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    let idempotent = true;
    if (cfg && cfg.enabled && !cfg.effectiveTo) {
      cfg.enabled = false; cfg.effectiveTo = now; cfg.changeReason = body.reason ?? '移除'; cfg.updatedAt = now; idempotent = false;
    }
    return { configId: body.configId, enabled: false, effectiveTo: now, idempotent };
  },
  history(params: URLSearchParams) {
    let rows = [...mockRoomDeviceConfigSeed].sort((a, b) => (b.effectiveFrom > a.effectiveFrom ? 1 : -1));
    const roomId = params.get('roomId');
    if (roomId) rows = rows.filter((c) => c.roomId === Number(roomId));
    return { list: rows, total: rows.length };
  },
};


function operationCaseDate(item: (typeof anesthesiaCases)[0]) {
  return dayjs(item.scheduledStart ?? item.plannedStart).format('YYYY-MM-DD');
}

function includesText(value: unknown, keyword: string) {
  return String(value ?? '').toLowerCase().includes(keyword.toLowerCase());
}

function matchesOperationListQuery(item: (typeof anesthesiaCases)[0], params: URLSearchParams) {
  const operationDate = params.get('operationDate') || params.get('date');
  if (operationDate && operationCaseDate(item) !== dayjs(operationDate).format('YYYY-MM-DD')) {
    return false;
  }

  const room = params.get('operationRoom') || params.get('room') || params.get('roomId');
  if (room) {
    const values = [item.room, item.roomId, item.roomName];
    if (!values.some((value) => includesText(value, room))) return false;
  }

  const patientName = params.get('patientName');
  if (patientName && !includesText(item.patientName, patientName)) {
    return false;
  }

  const inpatientNo = params.get('inpatientNo') || params.get('patientNumber') || params.get('patientId');
  if (inpatientNo) {
    const values = [item.patientId, item.id];
    if (!values.some((value) => includesText(value, inpatientNo))) return false;
  }

  return true;
}

function isCaseInRange(item: (typeof anesthesiaCases)[0], startTime?: string | null, endTime?: string | null) {
  if (!startTime && !endTime) return true;
  const date = dayjs(operationCaseDate(item));
  const start = startTime ? dayjs(startTime).startOf('day') : null;
  const end = endTime ? dayjs(endTime).endOf('day') : null;
  if (start && date.isBefore(start, 'day')) return false;
  if (end && date.isAfter(end, 'day')) return false;
  return true;
}

function handleSamisSyncPushBatch(body: PushBatchRequest): SamisApiResponse<PushBatchResponse> {
  const results: PushBatchResultItem[] = body.items.map((item) => {
    const localId = item.localId;
    const entityType = item.entityType;
    const key = entityKey(entityType, localId);
    const baseSyncVersion = item.baseSyncVersion ?? Number(getPayloadField(item.payload, 'baseSyncVersion') ?? 0);
    const operationType = item.operationType;
    const payload = item.payload ?? {};
    const recordLocked = Boolean(getPayloadField(payload, 'recordLocked') ?? getPayloadField(body, 'recordLocked'));
    const recordPrinted = Boolean(getPayloadField(payload, 'recordPrinted'));

    if (recordLocked || recordPrinted) {
      if (operationType === 'update' || operationType === 'delete' || operationType === 'void') {
        const existing = serverEntityRegistry.get(key);
        return {
          entityType,
          localId,
          serverId: existing?.serverId ?? item.serverId ?? null,
          status: 'conflict',
          conflictType: recordPrinted ? 'record_printed' : 'record_locked',
          message: recordPrinted ? 'record printed on server' : 'record locked on server',
          serverSyncVersion: existing?.syncVersion,
          serverPayload: existing?.payload ?? {},
        };
      }
    }

    if (entityType === 'monitor_raw' || entityType === 'ventilator_raw') {
      const collectTime = String(getPayloadField(payload, 'collectTime') ?? getPayloadField(payload, 'collect_time') ?? '');
      const dup = [...serverEntityRegistry.values()].find((row) =>
        row.entityType === entityType
        && (row.localId === localId || (collectTime && row.collectTime === collectTime)),
      );
      if (dup) {
        return {
          entityType,
          localId,
          serverId: dup.serverId,
          status: 'success',
          message: 'deduplicated',
          serverSyncVersion: dup.syncVersion,
        };
      }
      const serverId = nextServerId();
      serverEntityRegistry.set(key, {
        entityType,
        localId,
        serverId,
        syncVersion: 1,
        payload,
        collectTime,
      });
      return { entityType, localId, serverId, status: 'success', serverSyncVersion: 1 };
    }

    if (entityType === 'vital_sign') {
      const existing = serverEntityRegistry.get(key);
      const incomingSource = String(getPayloadField(payload, 'source') ?? '');
      if (existing?.isCorrected && incomingSource.includes('设备')) {
        return {
          entityType,
          localId,
          serverId: existing.serverId,
          status: 'conflict',
          conflictType: 'vital_corrected',
          message: 'vital corrected on server',
          serverSyncVersion: existing.syncVersion,
          serverPayload: existing.payload,
        };
      }
    }

    const conflictTypes = new Set(['medication', 'fluid', 'transfusion', 'timeline_event']);
    const existing = serverEntityRegistry.get(key);
    if (conflictTypes.has(entityType) && existing && baseSyncVersion < existing.syncVersion) {
      return {
        entityType,
        localId,
        serverId: existing.serverId,
        status: 'conflict',
        conflictType: 'version_mismatch',
        message: 'server sync version newer',
        serverSyncVersion: existing.syncVersion,
        serverPayload: existing.payload,
      };
    }

    if (operationType === 'delete' || operationType === 'void') {
      if (existing) {
        existing.deletedAt = new Date().toISOString();
        existing.syncVersion += 1;
        existing.payload = {
          ...existing.payload as object,
          deletedAt: existing.deletedAt,
          voidReason: getPayloadField(payload, 'voidReason') ?? 'void',
        };
        return {
          entityType,
          localId,
          serverId: existing.serverId,
          status: 'success',
          serverSyncVersion: existing.syncVersion,
        };
      }
      return { entityType, localId, serverId: nextServerId(), status: 'success', serverSyncVersion: 1 };
    }

    const nextVersion = existing ? existing.syncVersion + 1 : 1;
    const isCorrected = getPayloadField(payload, 'source') === '手工修正' || Boolean(getPayloadField(payload, 'correctedValue'));
    const serverId = existing?.serverId ?? item.serverId ?? nextServerId();
    serverEntityRegistry.set(key, {
      entityType,
      localId,
      serverId,
      syncVersion: nextVersion,
      payload,
      isCorrected: isCorrected || existing?.isCorrected,
    });
    return {
      entityType,
      localId,
      serverId,
      status: 'success',
      serverSyncVersion: nextVersion,
    };
  });
  return buildSamisSuccess({ batchNo: body.batchNo, results });
}

function handleSamisDeviceBatch(body: { items?: Array<{ localId: string }> }, entityType: string) {
  const items = body.items ?? [];
  return buildSamisSuccess({
    results: items.map((item) => ({
      entityType,
      localId: item.localId,
      serverId: nextServerId(),
      status: 'success' as const,
      message: '',
    })),
  });
}

function handleSamisRecordBatch(
  body: { items?: Array<{ localId?: string; id?: string }> },
  entityType: string,
) {
  const items = body.items ?? [];
  return buildSamisSuccess({
    results: items.map((item) => ({
      entityType,
      localId: item.localId ?? item.id ?? `${entityType}-${Date.now()}`,
      serverId: nextServerId(),
      status: 'success' as const,
      message: '',
      serverSyncVersion: 1,
    })),
  });
}

const MOCK_ROOMS = [
  { roomId: 'OR-01', roomName: 'OR-01', roomGroup: '手术中心' },
  { roomId: 'OR-02', roomName: 'OR-02', roomGroup: '手术中心' },
  { roomId: 'OR-03', roomName: 'OR-03', roomGroup: '手术中心' },
  { roomId: 'OR-04', roomName: 'OR-04', roomGroup: '手术中心' },
  { roomId: 'OR-05', roomName: 'OR-05', roomGroup: '手术中心' },
  { roomId: 'OR-06', roomName: 'OR-06', roomGroup: '手术中心' },
  { roomId: 'PACU', roomName: 'PACU', roomGroup: '恢复区' },
];

/**
 * Routes Samis-style paths (with or without /api-samis/pc/v1 prefix).
 */
export async function routeSamisMock<T>(path: string, init?: RequestInit): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 120));

  if (path.includes('/anesthesiaPlan/detail')) {
    const operationId = getSearchParams(path).get('operationId') ?? '';
    const currentPlan = mockAnesthesiaPlans.get(operationId) ?? null;
    const item = anesthesiaCases.find((row) => row.id === operationId);
    return buildSamisSuccess({
      operationId,
      operationCase: item ? { operationId: item.id, patientName: item.patientName, gender: item.gender, age: item.age, operationName: item.surgeryName, plannedStartTime: item.plannedStart } : { operationId },
      currentPlan,
      historyMeta: { total: currentPlan ? 1 : 0, versions: currentPlan ? [currentPlan] : [] },
    }) as T;
  }
  if (path.endsWith('/anesthesiaPlan/saveDraft') && init?.method === 'POST') {
    const body = parseBody<Record<string, unknown>>(init);
    const operationId = String(body.operationId ?? '');
    const current = mockAnesthesiaPlans.get(operationId);
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const saved = {
      planId: current?.planId ?? `PLAN-MOCK-${operationId}`,
      planVersionId: current?.planVersionId ?? `PLANV-MOCK-${operationId}`,
      operationId,
      version: current ? Number(current.version) + 1 : 1,
      status: 'draft',
      primaryMethodCode: null,
      primaryMethodName: null,
      alternativeMethods: [],
      airwayPlan: null,
      monitoringPlan: null,
      inductionPlan: null,
      maintenancePlan: null,
      analgesiaPlan: null,
      fluidPlan: null,
      bloodPreparation: null,
      postoperativeDestination: null,
      specialRisks: [],
      vascularAccessPlan: [], fluidPlanDetail: [], transfusionPlan: null, backupPlan: null, riskResponsePlan: [],
      templateCode: null, templateVersion: null, templateSnapshot: null, plannerId: 'MOCK-DOCTOR', plannerName: '模拟计划医师',
      notes: null,
      revisionReason: null,
      submittedAt: null,
      cancelledAt: null,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
      ...current,
      ...body,
    };
    mockAnesthesiaPlans.set(operationId, saved);
    return buildSamisSuccess(saved) as T;
  }
  if (path.endsWith('/anesthesiaPlan/submit') && init?.method === 'POST') {
    const body = parseBody<Record<string, unknown>>(init);
    const current = [...mockAnesthesiaPlans.values()].find((item) => item.planVersionId === body.planVersionId);
    if (!current) return buildSamisError('计划版本不存在', 3003) as T;
    if (!current.primaryMethodCode || !current.airwayPlan || !current.monitoringPlan || !current.postoperativeDestination) {
      return buildSamisError('麻醉计划必填项不完整', 2001) as T;
    }
    Object.assign(current, { status: 'submitted', version: Number(current.version) + 1, submittedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') });
    return buildSamisSuccess(current) as T;
  }
  if (path.endsWith('/anesthesiaPlan/cancel') && init?.method === 'POST') {
    const body=parseBody<Record<string,unknown>>(init); const current=[...mockAnesthesiaPlans.values()].find(item=>item.planVersionId===body.planVersionId);
    if(!current)return buildSamisError('计划版本不存在',3003) as T;
    Object.assign(current,{status:'cancelled',version:Number(current.version)+1,revisionReason:String(body.reason??''),cancelledAt:dayjs().format('YYYY-MM-DD HH:mm:ss')}); return buildSamisSuccess(current) as T;
  }
  if (path.endsWith('/anesthesiaPlan/createRevision') && init?.method === 'POST') {
    const body=parseBody<Record<string,unknown>>(init); const source=[...mockAnesthesiaPlans.values()].find(item=>item.planVersionId===body.planVersionId);
    if(!source)return buildSamisError('计划版本不存在',3003) as T;
    const revised={...source,planVersionId:`${source.planVersionId}-R`,status:'draft',version:Number(source.version)+1,revisionReason:String(body.reason??''),submittedAt:null,cancelledAt:null}; mockAnesthesiaPlans.set(String(source.operationId),revised); return buildSamisSuccess(revised) as T;
  }

  if (path.includes('/anesthesiaHandover/detail')) {
    const operationId = getSearchParams(path).get('operationId') ?? '';
    const activeHandover = mockAnesthesiaHandovers.get(operationId) ?? null;
    return buildSamisSuccess({ operationId, activeHandover, currentResponsibleDoctor: null, history: activeHandover ? [activeHandover] : [] }) as T;
  }
  if (path.endsWith('/anesthesiaHandover/saveDraft') && init?.method === 'POST') {
    const body = parseBody<Record<string, unknown>>(init);
    const operationId = String(body.operationId ?? '');
    const current = mockAnesthesiaHandovers.get(operationId);
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const saved = {
      handoverId: current?.handoverId ?? `HO-MOCK-${operationId}`,
      handoverVersionId: current?.handoverVersionId ?? `HOV-MOCK-${operationId}`,
      operationId,
      version: Number(current?.version ?? 1),
      status: 'draft',
      handoverType: 'shift_change',
      outgoingDoctorId: 'mock-doctor',
      outgoingDoctorName: '模拟麻醉医生',
      incomingDoctorId: null,
      incomingDoctorName: null,
      handoverAt: null,
      acceptedAt: null,
      priorityNotes: null,
      specialNotes: null,
      emergencyReason: null,
      pendingTasks: [],
      checks: [],
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
      ...current,
      ...body,
    };
    mockAnesthesiaHandovers.set(operationId, saved);
    return buildSamisSuccess(saved) as T;
  }
  if (path.endsWith('/anesthesiaHandover/submit') && init?.method === 'POST') {
    const body = parseBody<Record<string, unknown>>(init);
    const current = [...mockAnesthesiaHandovers.values()].find((item) => item.handoverVersionId === body.handoverVersionId);
    if (!current) return buildSamisError('交班版本不存在', 3003) as T;
    Object.assign(current, { status: 'submitted', handoverAt: dayjs().format('YYYY-MM-DD HH:mm:ss') });
    return buildSamisSuccess(current) as T;
  }
  if (path.endsWith('/anesthesiaHandover/accept') && init?.method === 'POST') {
    const body = parseBody<Record<string, unknown>>(init);
    const current = [...mockAnesthesiaHandovers.values()].find((item) => item.handoverVersionId === body.handoverVersionId);
    if (!current) return buildSamisError('交班版本不存在', 3003) as T;
    Object.assign(current, { status: 'accepted', acceptedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') });
    return buildSamisSuccess(current) as T;
  }

  if (path.endsWith('/anesthesiaSummary/generate') && init?.method === 'POST') {
    const body = parseBody<Record<string, unknown>>(init);
    const operationId = String(body.operationId ?? '');
    const current = mockAnesthesiaSummaries.get(operationId);
    const saved = current ?? {
      summaryId: `SUM-MOCK-${operationId}`,
      summaryVersionId: `SUMV-MOCK-${operationId}`,
      operationId,
      version: 1,
      status: 'draft',
      generatedPayload: { generatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'), statistics: { medicationCount: 0, vitalSignCount: 0, fluidCount: 0, eventCount: 0 } },
      effectRating: null,
      intraoperativeNotes: null,
      recoveryNotes: null,
      complicationSummary: null,
      postoperativeDestination: null,
      submittedAt: null,
      revisionReason: null,
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    };
    mockAnesthesiaSummaries.set(operationId, saved);
    return buildSamisSuccess(saved) as T;
  }
  if (path.endsWith('/anesthesiaSummary/saveDraft') && init?.method === 'POST') {
    const body = parseBody<Record<string, unknown>>(init);
    const current = [...mockAnesthesiaSummaries.values()].find((item) => item.summaryVersionId === body.summaryVersionId);
    if (!current) return buildSamisError('小结版本不存在', 3003) as T;
    Object.assign(current, body);
    return buildSamisSuccess(current) as T;
  }
  if (path.endsWith('/anesthesiaSummary/submit') && init?.method === 'POST') {
    const body = parseBody<Record<string, unknown>>(init);
    const current = [...mockAnesthesiaSummaries.values()].find((item) => item.summaryVersionId === body.summaryVersionId);
    if (!current) return buildSamisError('小结版本不存在', 3003) as T;
    Object.assign(current, { status: 'submitted', submittedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') });
    return buildSamisSuccess(current) as T;
  }

  if (path.includes('/preoperative/assessmentDetail')) {
    const operationId = getSearchParams(path).get('operationId') ?? '';
    const item = anesthesiaCases.find((row) => row.id === operationId);
    const operationCase = item ? {
      operationId: item.id,
      patientId: item.patientId,
      patientName: item.patientName,
      gender: item.gender,
      age: item.age,
      departmentName: item.department,
      roomName: item.room,
      operationName: item.surgeryName,
      status: item.status,
      surgeonName: item.surgeon,
      anesthesiologistName: item.anesthesiologist,
      plannedStartTime: item.plannedStart,
    } : { operationId };
    return buildSamisSuccess({
      operationCase,
      assessment: mockPreoperativeAssessmentState.get(operationId) ?? null,
      history: [],
      persistence: { available: true, reason: null },
    }) as T;
  }
  if (path.endsWith('/preoperative/assessmentSaveDraft') && init?.method === 'POST') {
    const body = parseBody<Record<string, unknown>>(init);
    const operationId = String(body.operationId ?? '');
    const previous = mockPreoperativeAssessmentState.get(operationId);
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const assessment: MockPreoperativeAssessment = {
      operationId,
      assessmentId: previous?.assessmentId ?? `PA-MOCK-${mockPreoperativeAssessmentSequence++}`,
      version: previous ? previous.version + 1 : 1,
      asaGrade: String(body.asaGrade ?? '') || null,
      anesthesiaPlan: String(body.anesthesiaPlan ?? '') || null,
      airwayAssessment: String(body.airwayAssessment ?? '') || null,
      allergyHistory: String(body.allergyHistory ?? '') || null,
      pastAnesthesiaHistory: String(body.pastAnesthesiaHistory ?? '') || null,
      abnormalExamSummary: String(body.abnormalExamSummary ?? '') || null,
      riskSummary: String(body.riskSummary ?? '') || null,
      preMedicationAdvice: String(body.preMedicationAdvice ?? '') || null,
      riskLevel: String(body.riskLevel ?? '') || null,
      cardiopulmonaryJson: (body.cardiopulmonaryJson as Record<string, unknown>) ?? null,
      airwayJson: (body.airwayJson as Record<string, unknown>) ?? null,
      fastingJson: (body.fastingJson as Record<string, unknown>) ?? null,
      dentitionJson: (body.dentitionJson as Record<string, unknown>) ?? null,
      medicalHistoryJson: (body.medicalHistoryJson as unknown[] | Record<string, unknown>) ?? null,
      surgicalHistoryJson: (body.surgicalHistoryJson as unknown[]) ?? null,
      medicationHistoryJson: (body.medicationHistoryJson as unknown[]) ?? null,
      systemAssessmentJson: (body.systemAssessmentJson as Record<string, unknown>) ?? null,
      examAbnormalitiesJson: (body.examAbnormalitiesJson as unknown[]) ?? null,
      riskFactorsJson: (body.riskFactorsJson as unknown[]) ?? null,
      recommendationsJson: (body.recommendationsJson as unknown[]) ?? null,
      status: 'draft',
      evaluatorId: 'MOCK-DOCTOR',
      evaluatorName: '模拟评估医师',
      evaluatedAt: now,
      submittedAt: null,
      updatedAt: now,
    };
    mockPreoperativeAssessmentState.set(operationId, assessment);
    return buildSamisSuccess(assessment) as T;
  }
  if (path.endsWith('/preoperative/assessmentSubmit') && init?.method === 'POST') {
    const operationId = String(parseBody<Record<string, unknown>>(init).operationId ?? '');
    const assessment = mockPreoperativeAssessmentState.get(operationId);
    if (!assessment) return buildSamisError('评估不存在', 404) as T;
    assessment.status = 'submitted';
    assessment.version += 1;
    assessment.submittedAt = dayjs().format('YYYY-MM-DD HH:mm:ss');
    assessment.updatedAt = assessment.submittedAt;
    return buildSamisSuccess(assessment) as T;
  }
  if (path.endsWith('/preoperative/assessmentCancelSubmit') && init?.method === 'POST') {
    const operationId = String(parseBody<Record<string, unknown>>(init).operationId ?? '');
    const assessment = mockPreoperativeAssessmentState.get(operationId);
    if (!assessment) return buildSamisError('评估不存在', 404) as T;
    assessment.status = 'draft';
    assessment.version += 1;
    assessment.submittedAt = null;
    assessment.updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss');
    return buildSamisSuccess(assessment) as T;
  }
  if (path.endsWith('/preoperative/assessmentCreateRevision') && init?.method === 'POST') {
    const body=parseBody<Record<string,unknown>>(init); const assessment=mockPreoperativeAssessmentState.get(String(body.operationId??''));
    if(!assessment)return buildSamisError('评估不存在',404) as T;
    assessment.status='draft'; assessment.version+=1; assessment.submittedAt=null; assessment.updatedAt=dayjs().format('YYYY-MM-DD HH:mm:ss'); return buildSamisSuccess(assessment) as T;
  }
  if (path.includes('/preoperative/assessmentHistory')) return buildSamisSuccess([]) as T;

  if (path.endsWith('/anesthesiaSync/pushBatch') && init?.method === 'POST') {
    return handleSamisSyncPushBatch(parseBody<PushBatchRequest>(init)) as T;
  }
  if (path.includes('/anesthesiaSync/getSyncStatus')) {
    return buildSamisSuccess({ pendingCount: 0, online: true, lastSyncedAt: new Date().toISOString() }) as T;
  }
  if (path.includes('/anesthesiaSync/getPendingCount')) {
    return buildSamisSuccess({ pendingCount: 0 }) as T;
  }
  if (path.endsWith('/anesthesiaSync/confirmBatch') && init?.method === 'POST') {
    const body = parseBody<{ batchNo: string }>(init);
    return buildSamisSuccess({ batchNo: body.batchNo, confirmed: true }) as T;
  }
  if (path.endsWith('/anesthesiaSync/resolveConflict') && init?.method === 'POST') {
    const body = parseBody<{ conflictId?: string; localId?: string; action?: string }>(init);
    return buildSamisSuccess({
      conflictId: body.conflictId ?? body.localId ?? `conflict-${Date.now()}`,
      action: body.action ?? 'keepLocal',
      resolved: true,
      resolvedAt: new Date().toISOString(),
    }) as T;
  }
  if (path.endsWith('/anesthesiaRecord/submitRecord') && init?.method === 'POST') {
    const body = parseBody<{ operationId?: string; recordLocalId?: string; expectedSyncVersion?: number | string }>(init);
    const syncVersion = Number(body.expectedSyncVersion ?? 1) + 1;
    return buildSamisSuccess({
      record: {
        operationId: body.operationId,
        recordLocalId: body.recordLocalId,
        status: 'submitted',
        syncVersion,
        documentVersion: 1,
        submittedAt: new Date().toISOString(),
        signedAt: null,
        archivedAt: null,
        contentHash: `mock-hash-${body.recordLocalId ?? 'record'}`,
      },
      revision: {
        revisionId: `MOCK-REV-${body.recordLocalId ?? Date.now()}`,
        version: 1,
        status: 'submitted',
      },
    }) as T;
  }
  if (path.endsWith('/anesthesiaRecord/saveRecord') && init?.method === 'POST') {
    const body = parseBody<{ localId?: string; caseId?: string }>(init);
    return buildSamisSuccess({ localId: body.localId ?? body.caseId ?? 'local-record', serverId: nextServerId() }) as T;
  }
  if (path.endsWith('/anesthesiaRecord/saveSnapshot') && init?.method === 'POST') {
    const body = parseBody<{ snapshotId?: string; localId?: string }>(init);
    return buildSamisSuccess({
      snapshotId: body.snapshotId ?? body.localId ?? `snapshot-${Date.now()}`,
      serverId: nextServerId(),
      savedAt: new Date().toISOString(),
    }) as T;
  }
  if (path.endsWith('/anesthesiaRecord/batchSaveTimelineEvents') && init?.method === 'POST') {
    return handleSamisRecordBatch(parseBody(init), 'timeline_event') as T;
  }
  if (path.endsWith('/anesthesiaRecord/batchSaveMedications') && init?.method === 'POST') {
    return handleSamisRecordBatch(parseBody(init), 'medication') as T;
  }
  if (path.endsWith('/anesthesiaRecord/batchSaveFluids') && init?.method === 'POST') {
    return handleSamisRecordBatch(parseBody(init), 'fluid') as T;
  }
  if (path.endsWith('/anesthesiaRecord/batchSaveTransfusions') && init?.method === 'POST') {
    return handleSamisRecordBatch(parseBody(init), 'transfusion') as T;
  }
  if (path.endsWith('/anesthesiaRecord/batchSaveVitalSigns') && init?.method === 'POST') {
    return handleSamisRecordBatch(parseBody(init), 'vital_sign') as T;
  }
  if (path.endsWith('/anesthesiaRecord/lockRecord') && init?.method === 'POST') {
    const body = parseBody<{ operationId?: string; recordLocalId?: string }>(init);
    return buildSamisSuccess({
      operationId: body.operationId,
      recordLocalId: body.recordLocalId,
      locked: true,
      lockedAt: new Date().toISOString(),
    }) as T;
  }
  if (path.endsWith('/anesthesiaRecord/voidRecord') && init?.method === 'POST') {
    const body = parseBody<{ operationId?: string; recordLocalId?: string; voidReason?: string }>(init);
    return buildSamisSuccess({
      operationId: body.operationId,
      recordLocalId: body.recordLocalId,
      voidReason: body.voidReason,
      voided: true,
      voidedAt: new Date().toISOString(),
    }) as T;
  }
  if (path.endsWith('/anesthesiaRecord/saveIoRecord') && init?.method === 'POST') {
    const body = parseBody<{ localId?: string; id?: string }>(init);
    return buildSamisSuccess({
      localId: body.localId ?? body.id ?? `io-${Date.now()}`,
      serverId: nextServerId(),
      savedAt: new Date().toISOString(),
    }) as T;
  }
  if (path.endsWith('/anesthesiaRecord/saveLabResult') && init?.method === 'POST') {
    const body = parseBody<{ localId?: string; id?: string }>(init);
    return buildSamisSuccess({
      localId: body.localId ?? body.id ?? `lab-${Date.now()}`,
      serverId: nextServerId(),
      savedAt: new Date().toISOString(),
    }) as T;
  }
  if (path.endsWith('/anesthesiaDevice/batchPushMonitorData') && init?.method === 'POST') {
    return handleSamisDeviceBatch(parseBody(init), 'monitor_raw') as T;
  }
  if (path.endsWith('/anesthesiaDevice/batchPushVentilatorData') && init?.method === 'POST') {
    return handleSamisDeviceBatch(parseBody(init), 'ventilator_raw') as T;
  }
  if (path.includes('/anesthesiaDevice/getLatestDeviceData')) {
    // 会话格式：mock 模式下无配置 → 返回结构化错误，前端显示具体原因（不再无限"正在关联"）
    return buildSamisSuccess({
      operationId: getSearchParams(path).get('operationId') ?? '',
      binding: null, device: null, latest: null, items: [],
      nextCursor: null, hasMore: false, roomChanged: false,
      status: 'room_device_not_configured', error: '手术间未配置设备，请在"手术间设备配置"中配置主设备',
      message: '手术间未配置设备', serverTime: new Date().toISOString(),
    }) as T;
  }
  // 独立服务器时间（不依赖设备 binding）
  if (path.includes('/system/now')) {
    return buildSamisSuccess({ serverTime: new Date().toISOString(), timezone: 'Asia/Shanghai' }) as T;
  }
  // 关键时间正式保存 + 读取（后端闭环 mock）
  if (path.endsWith('/anesthesiaRecord/saveTimelineNode') && init?.method === 'POST') {
    return buildSamisSuccess(handleTimelineNodeSave(parseBody(init))) as T;
  }
  if (path.includes('/anesthesiaRecord/getTimelineNodes')) {
    const op = getSearchParams(path).get('operationId') ?? '';
    return buildSamisSuccess({ nodes: handleTimelineNodeGet(op) }) as T;
  }
  // ---- SAMIS 手术间设备采集配置（mock 内存态，便于前端热加载验证） ----
  if (path.includes('/anesthesiaDevice/roomDeviceConfigList')) {
    return buildSamisSuccess(roomDeviceConfigMock.list()) as T;
  }
  if (path.includes('/anesthesiaDevice/roomDeviceOptions')) {
    return buildSamisSuccess(roomDeviceConfigMock.options(getSearchParams(path).get('keyword') ?? undefined)) as T;
  }
  if (path.endsWith('/anesthesiaDevice/saveRoomDeviceConfig') && init?.method === 'POST') {
    return buildSamisSuccess(roomDeviceConfigMock.save(parseBody(init))) as T;
  }
  if (path.endsWith('/anesthesiaDevice/removeRoomDeviceConfig') && init?.method === 'POST') {
    return buildSamisSuccess(roomDeviceConfigMock.remove(parseBody(init))) as T;
  }
  if (path.includes('/anesthesiaDevice/roomDeviceConfigHistory')) {
    return buildSamisSuccess(roomDeviceConfigMock.history(getSearchParams(path))) as T;
  }
  if (path.includes('/anesthesiaRecord/getRecordDetail')) {
    const operationId = getSearchParams(path).get('operationId') ?? '';
    const { mockApi } = await import('@/services/mockApi');
    const payload = mockApi.getAnesthesiaRecord(operationId);
    return buildSamisSuccess(payload ?? { operationId, record: null }) as T;
  }

  if (path.includes('/operationInfo/getOperationList')) {
    const params = getSearchParams(path);
    const list = anesthesiaCases.filter((item) => matchesOperationListQuery(item, params)).map(caseToOperationRow);
    return buildSamisSuccess({
      list,
      total: list.length,
    }) as T;
  }
  if (path.includes('/operationInfo/todayWorkbench')) {
    const today = dayjs().format('YYYY-MM-DD');
    const todayCases = anesthesiaCases
      .filter((item) => operationCaseDate(item) === today)
      .map(caseToOperationRow);
    const roomMap = new Map<string, { roomId: string; roomName: string; busy: boolean; count: number }>();
    todayCases.forEach((row) => {
      const roomId = String(row.room ?? row.roomId ?? '').trim();
      if (!roomId) return;
      if (!roomMap.has(roomId)) {
        roomMap.set(roomId, { roomId, roomName: roomId, busy: false, count: 0 });
      }
      const entry = roomMap.get(roomId)!;
      entry.count += 1;
      const activeStatuses = ['麻醉诱导', '麻醉中', '手术中', '苏醒中'];
      if (activeStatuses.includes(String(row.status ?? ''))) entry.busy = true;
    });
    const roomStatus = Array.from(roomMap.values());
    return buildSamisSuccess({
      todayCases,
      roomStatus,
      summary: {
        surgeries: todayCases.length,
        busyRooms: roomStatus.filter((r) => r.busy).length,
        roomCount: roomStatus.length,
        canceled: todayCases.filter((r) => String(r.status ?? '') === '已取消').length,
        operationDate: today,
      },
    }) as T;
  }
  if (path.includes('/operationInfo/getOperationInfo')) {
    const params = getSearchParams(path);
    const operationId = params.get('operationId') ?? params.get('OPERATIONID') ?? '';
    const seed = findCaseByOperationId(operationId);
    const row = seed ? caseToOperationRow(seed) : {
      operationId,
      patientName: 'Mock Patient',
      surgeryName: 'Mock Surgery',
      room: 'OR-01',
      diagnosis: 'Mock Diagnosis',
    };
    return buildSamisSuccess({
      ...row,
      preMedication: seed?.preVisit.preMedication,
      fasting: seed?.preVisit.fasting,
      height: seed?.preVisit.height,
      weight: seed?.preVisit.weight,
      circulatingNurses: seed?.circulatingNurses,
      scrubNurses: seed?.scrubNurses,
    }) as T;
  }
  if (path.includes('/operationInfo/getNursePbList')) {
    const params = getSearchParams(path);
    const list = anesthesiaCases.filter((c) => isCaseInRange(c, params.get('startTime'), params.get('endTime')));
    return buildSamisSuccess({
      list: list.map((c) => ({
        operationId: c.id,
        room: c.room,
        roomId: c.roomId ?? c.room,
        roomName: c.roomName ?? c.room,
        operationDate: operationCaseDate(c),
        scheduledStart: c.scheduledStart ?? c.plannedStart,
        scheduledEnd: c.scheduledEnd,
        numberOfStations: c.sequence,
        anesthesiologist: c.anesthesiologist,
        nurse: c.anesthesiaNurse,
        circulatingNurse: joinDisplayValue(c.circulatingNurses, c.anesthesiaNurse),
        scrubNurse: joinDisplayValue(c.scrubNurses),
      })),
      total: list.length,
    }) as T;
  }
  if (path.endsWith('/operationInfo/saveNursePb') && init?.method === 'POST') {
    return buildSamisSuccess({ saved: true }) as T;
  }
  if (path.endsWith('/operationInfo/updateNumberOfStations') && init?.method === 'POST') {
    return buildSamisSuccess({ updated: true }) as T;
  }
  if (path.endsWith('/operationInfo/updateOperationInfo') && init?.method === 'POST') {
    return buildSamisSuccess({ updated: true }) as T;
  }

  if (path.includes('/room/getRoomList')) {
    return buildSamisSuccess({ list: MOCK_ROOMS }) as T;
  }
  if (path.includes('/room/getRoomGroupList')) {
    return buildSamisSuccess({
      list: [
        { roomGroupId: 'g-or', roomGroupName: '手术中心', rooms: MOCK_ROOMS.filter((r) => r.roomGroup === '手术中心') },
        { roomGroupId: 'g-pacu', roomGroupName: '恢复区', rooms: MOCK_ROOMS.filter((r) => r.roomGroup === '恢复区') },
      ],
    }) as T;
  }
  if (path.endsWith('/room/roomCreate') && init?.method === 'POST') {
    return buildSamisSuccess({ id: nextServerId() }) as T;
  }
  if (path.endsWith('/room/roomGroupCreate') && init?.method === 'POST') {
    return buildSamisSuccess({ id: nextServerId() }) as T;
  }
  if ((path.endsWith('/room/roomUpdate') || path.endsWith('/room/roomDelete')
    || path.endsWith('/room/roomGroupUpdate') || path.endsWith('/room/roomGroupDelete')) && init?.method === 'POST') {
    return buildSamisSuccess(true) as T;
  }

  if (path.includes('/admin/login') && init?.method === 'POST') {
    const body = parseBody<{ username?: string; password?: string }>(init);
    const login = body.username ?? 'user';
    return buildSamisSuccess({
      token: `mock-token-${login}`,
      userInfo: {
        id: 'mock-user-1',
        name: '演示用户',
        GH: login,
        token: `mock-token-${login}`,
        department_code: 'ANES',
        department_name: '麻醉科',
      },
    }) as T;
  }
  if (path.includes('/adminUser/getAdminUserInfo')
    || path.includes('/user/getLoginUser')
    || path.includes('/user/getCurrentUser')) {
    return buildSamisSuccess({
      userId: 'mock-user-1',
      userName: '王睿',
      loginName: 'wangrui',
      gh: 'wangrui',
      room: 'OR-01',
      roomGroup: '手术中心',
      roleNames: ['麻醉医生'],
    }) as T;
  }
  if (path.includes('/auth/myPermissions')) {
    return buildSamisSuccess({ permissions: ['*'], role: 'developer', groupid: 1 }) as T;
  }
  if (path.includes('/quality/configGet')) {
    const params = getSearchParams(path);
    const key = params.get('key') ?? '';
    const scope = params.get('scope') ?? 'global';
    const stored = readMockClinicalConfig(key, scope);
    const value = stored ?? (key === 'device_realtime_data_source' ? 'simulation' : null);
    return buildSamisSuccess({ key, value, scope, source: stored === null ? 'default' : 'database' }) as T;
  }
  if (path.endsWith('/quality/configSet') && init?.method === 'POST') {
    const body = parseBody<{ key?: string; value?: string; scope?: string }>(init);
    const key = String(body.key ?? '');
    const value = String(body.value ?? '');
    const scope = String(body.scope ?? 'global');
    if (key === 'device_realtime_data_source' && value !== 'simulation' && value !== 'real') {
      return buildSamisError('实时设备数据源仅允许 simulation 或 real', 1001) as T;
    }
    mockClinicalConfigState.set(`${key}:${scope}`, value);
    return buildSamisSuccess({ key, value, scope, source: 'database' }) as T;
  }
  if (path.includes('/quality/indicators')) {
    const category = getSearchParams(path).get('category');
    const list = qualityIndicators
      .filter((item) => !category || category === '全部' || item.category === category)
      .map((item) => ({
        code: item.code,
        name: item.name,
        category: item.category,
        unit: item.unit,
        numerator: 0,
        denominator: 0,
        rate: 0,
        value: 0,
        expression: item.formulaText,
        displayValue: item.unit === '%' || item.unit === '‰' ? `0${item.unit}` : '0',
        target: item.warningRule ? `${item.warningRule.operator}${item.warningRule.value}` : null,
        warningRule: item.warningRule ?? null,
        met: true,
        status: 'no-data',
        denominatorDefinition: item.denominatorName,
        numeratorDefinition: item.numeratorName,
        exclusions: [],
        timeWindow: { anchor: 'operationDate', granularity: 'month', timezone: 'Asia/Shanghai' },
        evidenceFields: item.dataSources,
        severity: '提示',
        drilldown: { denominator: item.supportDrillDown, numerator: item.supportDrillDown, defect: item.supportDrillDown },
        remediationAction: '请根据病例穿透结果处理',
      }));
    return buildSamisSuccess(list) as T;
  }

  // ============ 系统管理（T04/T05）mock 兜底：adminUserList / adminUserGroupsList / getMenu ============
  if (path.includes('/adminUser/adminUserList')) {
    const list = [
      { id: 1, name: '质控管理员', GH: 'quality_admin', NumGh: 'quality_admin', groupid: 999, department_name: '麻醉科', department_code: 'ANES', type: 1, is_del: 0 },
      { id: 2, name: '王睿', GH: 'wangrui', NumGh: 'wangrui', groupid: 1, department_name: '麻醉科', department_code: 'ANES', type: 3, is_del: 0 },
      { id: 3, name: '陈洁', GH: 'chenjie', NumGh: 'chenjie', groupid: 2, department_name: '麻醉科', department_code: 'ANES', type: 3, is_del: 0 },
    ];
    return buildSamisSuccess({ list, page: 1, page_size: list.length, total: list.length }) as T;
  }
  if (path.includes('/adminUserGroup/adminUserGroupsList')) {
    const list = [
      { id: 1, groupid: 999, name: '质控管理员', catids: '1,2,3,4,5', catidsList: ['质控看板', '缺陷整改', '用户管理', '系统配置', '报表导出'] },
      { id: 2, groupid: 1, name: '麻醉医师', catids: '6,7,8', catidsList: ['手术排班', '麻醉记录单', '术前访视'] },
      { id: 3, groupid: 2, name: '麻醉护士', catids: '9,10', catidsList: ['PACU接收', '转出登记'] },
    ];
    return buildSamisSuccess({ page: 1, pageSize: list.length, total: list.length, list }) as T;
  }
  if (path.includes('/adminCategory/getMenu')) {
    const tree = [
      { id: 1, name: '工作台', pid: 0, url: '/workbench', childsList: [{ id: 11, name: '总览', pid: 1 }] },
      { id: 2, name: '质控', pid: 0, url: '/quality', childsList: [{ id: 21, name: '质控看板', pid: 2 }] },
      { id: 3, name: '系统管理', pid: 0, url: '/system', childsList: [{ id: 31, name: '用户管理', pid: 3 }, { id: 32, name: '角色权限', pid: 3 }] },
    ];
    return buildSamisSuccess(tree) as T;
  }
  if (path.includes('/adminUser/adminUserCreate') && init?.method === 'POST') {
    return buildSamisSuccess({ id: nextServerId() }) as T;
  }
  if ((path.endsWith('/adminUser/adminUserUpdate') || path.endsWith('/adminUser/adminUserDelete') || path.endsWith('/adminUser/changePassword')) && init?.method === 'POST') {
    return buildSamisSuccess(true) as T;
  }

  if (path.includes('/anesthesiaDict/getSpecialDrugCategories')) {
    return buildSamisSuccess(SPECIAL_DRUG_CATEGORY_OPTIONS) as T;
  }
  if (path.includes('/anesthesiaDict/getDrugRecommend')) {
    const params = new URL(path, 'http://local').searchParams;
    const drug = seedDrugDict.find((d) => d.id === params.get('drug_id') || d.name === params.get('drug_name'));
    return buildSamisSuccess(drug ? buildDrugRecommendFromDict(drug) : null) as T;
  }
  if (path.includes('/anesthesiaDict/getDrugDict')) {
    const list = seedDrugDict.filter((d) => d.enabled).map(drugDictItemToApi);
    return buildSamisSuccess({ list, page: 1, page_size: list.length, total: list.length }) as T;
  }
  if (path.includes('/anesthesiaDict/getFluidDict')) {
    const list = seedFluidBloodDict.filter((d) => d.enabled).map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      subCategory: item.subCategory,
      enabled: item.enabled,
    }));
    return buildSamisSuccess({ list, page: 1, page_size: list.length, total: list.length }) as T;
  }
  if (path.includes('/anesthesiaDict/saveDrugDict')) {
    return buildSamisSuccess({ drugId: parseBody<{ drugId?: string }>(init).drugId ?? `drug-mock-${Date.now()}` }) as T;
  }
  if (path.includes('/anesthesiaDict/disableDrugDict')) {
    return buildSamisSuccess(null) as T;
  }
  if (
    path.includes('/anesthesiaDict/getTemplate')
    || path.includes('/anesthesiaDict/getTemplateField')
    || path.includes('/anesthesiaDict/getBloodProductDict')
    || path.includes('/anesthesiaDict/getEventDict')
    || path.includes('/anesthesiaDict/getDeviceDict')
  ) {
    if (path.includes('/anesthesiaDict/getTemplate')) {
      const templates = [
        { id: 1, template_code: 'TPL_ANES_RECORD', template_name: '麻醉记录单', template_type: 'record', is_default: 1, is_active: 1 },
        { id: 2, template_code: 'TPL_PREOP_VISIT', template_name: '术前访视单', template_type: 'preop', is_default: 0, is_active: 1 },
        { id: 3, template_code: 'TPL_PACU_RECORD', template_name: 'PACU恢复记录', template_type: 'pacu', is_default: 0, is_active: 1 },
        { id: 4, template_code: 'TPL_POSTOP_FOLLOWUP', template_name: '术后随访表', template_type: 'postop', is_default: 0, is_active: 1 },
      ];
      return buildSamisSuccess({ list: templates, page: 1, page_size: templates.length, total: templates.length }) as T;
    }
    return buildSamisSuccess({ list: [], page: 1, page_size: 10, total: 0 }) as T;
  }
  if (path.includes('/anesthesiaDict/getVitalDict')) {
    const list = seedVitalSignDict.map((item) => ({
      id: Number(item.id.replace(/\D/g, '')) || 0,
      code: item.code,
      short_code: item.shortCode,
      item_name: item.name,
      unit: item.unit,
      normal_range: item.normalRange,
      lower_limit: item.lowerLimit,
      upper_limit: item.upperLimit,
      default_value: item.defaultValue,
      chart_enabled: item.chartEnabled ? 1 : 0,
      chart_color: item.chartColor,
      chart_symbol: item.chartSymbol,
      decimal_places: item.decimalPlaces,
      sort_no: item.sortOrder,
      is_active: item.enabled ? 1 : 0,
    }));
    return buildSamisSuccess({ list, page: 1, page_size: list.length, total: list.length }) as T;
  }
  if (path.includes('/anesthesiaDict/getStaff')) {
    const list = [
      { id: 1, gh: 'A001', name: '张明远', title: '主任医师', department_name: '麻醉科', role: '麻醉医生', scheduling_weight: 3, sort_no: 1, is_active: 1 },
      { id: 2, gh: 'A002', name: '李文博', title: '副主任医师', department_name: '麻醉科', role: '麻醉医生', scheduling_weight: 2, sort_no: 2, is_active: 1 },
      { id: 3, gh: 'N001', name: '陈丽华', title: '护士长', department_name: '麻醉科', role: '麻醉护士', scheduling_weight: 2, sort_no: 3, is_active: 1 },
    ];
    return buildSamisSuccess({ list, page: 1, page_size: list.length, total: list.length }) as T;
  }
  if (path.includes('/anesthesiaDict/getDictCategory')) {
    const list = seedMethodCategories.map((cat, index) => ({
      id: index + 1,
      category_code: cat.code,
      category_name: cat.name,
      sort_no: index + 1,
      is_active: cat.enabled ? 1 : 0,
    }));
    return buildSamisSuccess({ list, page: 1, page_size: list.length, total: list.length }) as T;
  }
  if (path.includes('/anesthesiaDict/getDictItem')) {
    const params = getSearchParams(path);
    const categoryCode = params.get('category_code') || params.get('categoryCode') || '';
    if (categoryCode === 'anesthesia_method') {
      const list: Array<Record<string, unknown>> = [];
      seedMethodCategories.forEach((cat) => {
        cat.children.forEach((child, idx) => list.push({
          id: list.length + 1,
          category_code: 'anesthesia_method',
          item_code: child.code,
          item_name: child.name,
          parent_code: cat.code,
          sort_no: idx + 1,
          is_active: child.enabled ? 1 : 0,
        }));
      });
      return buildSamisSuccess({ list, page: 1, page_size: list.length, total: list.length }) as T;
    }
    if (categoryCode === 'anesthesia_event') {
      const names = ['插管', '拔管', '低体温', '低血压', '低氧', '抢救', '非计划转ICU'];
      const list = names.map((name, idx) => ({ id: idx + 1, category_code: 'anesthesia_event', item_code: `EVT-${idx + 1}`, item_name: name, sort_no: idx + 1, is_active: 1 }));
      return buildSamisSuccess({ list, page: 1, page_size: list.length, total: list.length }) as T;
    }
    if (categoryCode === 'anesthesia_score') {
      const names = ['Aldrete', 'VAS', 'GCS', 'Apgar'];
      const list = names.map((name, idx) => ({ id: idx + 1, category_code: 'anesthesia_score', item_code: `SCORE-${idx + 1}`, item_name: name, sort_no: idx + 1, is_active: 1 }));
      return buildSamisSuccess({ list, page: 1, page_size: list.length, total: list.length }) as T;
    }
    return buildSamisSuccess({ list: [], page: 1, page_size: 10, total: 0 }) as T;
  }
  if (path.includes('/anesthesiaDict/save') || path.includes('/anesthesiaDict/disable') || path.includes('/anesthesiaDict/delete')) {
    return buildSamisSuccess(null) as T;
  }

  if (path.includes('/pacu/list')) {
    return buildSamisSuccess({
      list: mockPacuState.map(pacuPatientToApiRow),
      page: 1,
      page_size: mockPacuState.length,
      total: mockPacuState.length,
    }) as T;
  }
  if (path.includes('/pacu/getById')) {
    const id = getSearchParams(path).get('id') ?? '';
    const row = mockPacuState.find((p) => p.id === id);
    return buildSamisSuccess(row ? pacuPatientToApiRow(row) : null) as T;
  }
  if (path.endsWith('/pacu/admit') && init?.method === 'POST') {
    const body = parseBody<{ caseId?: string; patientName?: string; room?: string; firstTemp?: string | number; aldreteIn?: string | number; pacuInTime?: string }>(init);
    const existing = mockPacuState.find((p) => p.status !== '已转出' && p.caseId === body.caseId);
    if (existing) {
      return buildSamisError('该病例已存在活跃的 PACU 恢复单（未转出），不可重复入室', 1003) as T;
    }
    const id = `pacu-mock-${Date.now()}`;
    const row: typeof mockPacuState[number] = {
      id,
      caseId: body.caseId ?? `case-${Date.now()}`,
      patientName: body.patientName ?? '未知患者',
      room: body.room ?? '',
      inTime: body.pacuInTime ?? new Date().toISOString(),
      firstTemperature: body.firstTemp !== undefined ? Number(body.firstTemp) : undefined,
      HR: 0, BP: '', SpO2: 0, RR: 0,
      aldrete: body.aldreteIn !== undefined ? Number(body.aldreteIn) : 0,
      vas: 0, nausea: false, shivering: false, agitation: false, reintubation: false,
      status: '观察中',
      transferTo: '病房',
      handover: '',
    };
    mockPacuState.push(row);
    return buildSamisSuccess(pacuPatientToApiRow(row)) as T;
  }
  if (path.endsWith('/pacu/update') && init?.method === 'POST') {
    const body = parseBody<{ id?: string; status?: string }>(init);
    const index = mockPacuState.findIndex((p) => p.id === String(body.id ?? ''));
    if (index >= 0 && body.status) (mockPacuState[index] as { status: string }).status = body.status;
    return buildSamisSuccess(true) as T;
  }
  if (path.endsWith('/pacu/transferOut') && init?.method === 'POST') {
    const body = parseBody<{ id?: string; outDestination?: string; pacuOutTime?: string }>(init);
    const row = mockPacuState.find((p) => p.id === String(body.id ?? ''));
    if (row) {
      (row as { status: string }).status = '已转出';
      (row as { outTime?: string }).outTime = body.pacuOutTime ?? new Date().toISOString();
      (row as { transferTo: string }).transferTo = (body.outDestination ?? '病房') as typeof row.transferTo;
    }
    return buildSamisSuccess(true) as T;
  }

  if (path.includes('/pacu/bookingList')) {
    return buildSamisSuccess({
      list: mockPacuBookingState,
      page: 1,
      page_size: mockPacuBookingState.length,
      total: mockPacuBookingState.length,
    }) as T;
  }
  if (path.includes('/pacu/bookingGetById')) {
    const id = getSearchParams(path).get('id') ?? '';
    const row = mockPacuBookingState.find((b) => b.id === id);
    return buildSamisSuccess(row ?? null) as T;
  }
  if (path.endsWith('/pacu/bookingCreate') && init?.method === 'POST') {
    const body = parseBody<{
      caseId?: string;
      patientName?: string;
      pacuRoomId?: string;
      bedId?: string;
      bookingTime?: string;
      bookingDoctor?: string;
      bookingType?: string;
    }>(init);
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const row: MockPacuBooking = {
      id: `bk-mock-${mockBookingIdCounter.value++}`,
      caseId: body.caseId ?? `case-${Date.now()}`,
      patientName: body.patientName ?? null,
      pacuRoomId: body.pacuRoomId ?? null,
      bedId: body.bedId ?? null,
      bookingTime: body.bookingTime ?? now,
      bookingDoctor: body.bookingDoctor ?? null,
      bookingType: body.bookingType ?? '常规预约',
      status: '待接收',
      remark: null,
      createdAt: now,
      updatedAt: now,
    };
    mockPacuBookingState.unshift(row);
    return buildSamisSuccess(row) as T;
  }
  if (path.endsWith('/pacu/bookingUpdate') && init?.method === 'POST') {
    const body = parseBody<Record<string, unknown>>(init);
    const row = mockPacuBookingState.find((b) => b.id === String(body.id ?? ''));
    if (row) {
      for (const key of ['patientName', 'pacuRoomId', 'bedId', 'bookingTime', 'bookingDoctor', 'bookingType']) {
        if (body[key] !== undefined) (row as unknown as Record<string, unknown>)[key] = body[key];
      }
      row.updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss');
    }
    return buildSamisSuccess(row ?? null) as T;
  }
  if (path.endsWith('/pacu/bookingCancel') && init?.method === 'POST') {
    const body = parseBody<{ id?: string }>(init);
    const row = mockPacuBookingState.find((b) => b.id === String(body.id ?? ''));
    if (row) {
      row.status = '已取消';
      row.updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss');
    }
    return buildSamisSuccess(row ?? null) as T;
  }

  // ============ Slice 6c A：床位 mock ============
  if (path.includes('/pacu/bedList')) {
    const list = mockBedState.map((b) => ({ ...b }));
    return buildSamisSuccess({ list, page: 1, page_size: list.length, total: list.length }) as T;
  }
  if (path.includes('/pacu/bedAllGrouped')) {
    const grouped: Record<string, typeof mockBedState> = {};
    for (const bed of mockBedState) {
      (grouped[bed.roomId] ??= []).push(bed);
    }
    const rooms = Object.entries(grouped).map(([roomId, beds]) => ({ roomId, roomName: null, beds }));
    return buildSamisSuccess(rooms) as T;
  }
  if (path.includes('/pacu/bedGetById')) {
    const id = Number(getSearchParams(path).get('id') ?? 0);
    return buildSamisSuccess(mockBedState.find((b) => b.id === id) ?? null) as T;
  }
  if (path.includes('/pacu/bedStats')) {
    const stats = {
      total: mockBedState.length,
      used: mockBedState.filter((b) => b.status === '占用').length,
      free: mockBedState.filter((b) => b.status === '空闲').length,
      reserved: mockBedState.filter((b) => b.status === '预留').length,
      maintenance: mockBedState.filter((b) => b.status === '维护').length,
    };
    return buildSamisSuccess(stats) as T;
  }
  if (path.endsWith('/pacu/bedCreate') && init?.method === 'POST') {
    const body = parseBody<Record<string, unknown>>(init);
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const roomId = String(body.roomId ?? '');
    const bedNo = String(body.bedNo ?? '');
    if (mockBedState.some((b) => b.roomId === roomId && b.bedNo === bedNo)) {
      return buildSamisError('该房间床位号已存在', 1203) as T;
    }
    const id = ++mockBedIdCounter.value;
    const row = {
      id,
      roomId,
      bedNo,
      status: String(body.status ?? '空闲'),
      patientName: null as string | null,
      caseId: null as string | null,
      inTime: null as string | null,
      outTime: null as string | null,
      remark: body.remark ? String(body.remark) : null,
      createdAt: now,
      updatedAt: now,
    };
    mockBedState.push(row);
    return buildSamisSuccess(row) as T;
  }
  if (path.endsWith('/pacu/bedUpdate') && init?.method === 'POST') {
    const body = parseBody<Record<string, unknown>>(init);
    const row = mockBedState.find((b) => b.id === Number(body.id ?? 0));
    if (row) {
      for (const key of ['status', 'remark', 'patientName', 'caseId']) {
        if (body[key] !== undefined) (row as unknown as Record<string, unknown>)[key] = body[key];
      }
      row.updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss');
    }
    return buildSamisSuccess(row ?? null) as T;
  }
  if (path.endsWith('/pacu/bedDelete') && init?.method === 'POST') {
    const body = parseBody<{ id?: string }>(init);
    const id = Number(body.id ?? 0);
    const idx = mockBedState.findIndex((b) => b.id === id);
    if (idx >= 0) mockBedState.splice(idx, 1);
    return buildSamisSuccess(true) as T;
  }

  // ============ Slice 6c B：质控专项聚合 + 抽查 mock ============
  if (path.includes('/quality/hypothermiaCases')) {
    // mock 模式聚合派生自本地 case 种子（含低体温事件）
    const lowTempCases = anesthesiaCases
      .filter((c) => c.events.some((e) => e.type === '低体温'))
      .map((c) => ({
        caseId: c.id,
        patientName: c.patientName,
        room: c.room,
        department: c.department ?? '',
        operationName: c.surgeryName,
        anesthesiaMethod: c.anesthesiaMethod,
        doctorName: c.anesthesiologist ?? '',
        isGeneralAnesthesia: c.anesthesiaMethod.includes('全麻'),
        evidence: c.events.filter((e) => e.type === '低体温').map((e) => ({ source: 'event' as const, type: e.type })),
      }));
    return buildSamisSuccess({ total: lowTempCases.length, list: lowTempCases }) as T;
  }
  if (path.includes('/quality/adverseEvents')) {
    const QUALITY_EVENTS = ['低血压', '高血压', '低氧', '低体温', '困难气道', '反流误吸', '严重过敏', '心脏骤停', '牙齿损伤', '非计划转ICU', '非计划二次插管', '抢救'];
    const list: Array<Record<string, unknown>> = [];
    let evtId = 1;
    for (const c of anesthesiaCases) {
      for (const e of c.events) {
        if (QUALITY_EVENTS.some((kw) => e.type.includes(kw))) {
          list.push({
            id: evtId++,
            caseId: c.id,
            patientName: c.patientName,
            room: c.room,
            department: c.department ?? '',
            operationName: c.surgeryName,
            type: e.type,
            name: e.type,
            stage: e.stage ?? '',
            severity: e.severity ?? '',
            treatment: e.treatment ?? '',
            description: '',
            reviewStatus: e.reported ? '已确认' : '待审核',
            eventTime: e.time ?? null,
          });
        }
      }
    }
    return buildSamisSuccess({ total: list.length, list }) as T;
  }
  if (path.includes('/quality/checkList')) {
    const params = getSearchParams(path);
    const result = params.get('result');
    let list = mockQualityCheckState.slice();
    if (result) list = list.filter((c) => c.result === result);
    return buildSamisSuccess({ list, page: 1, page_size: list.length, total: list.length }) as T;
  }
  if (path.includes('/quality/checkGetById')) {
    const id = Number(getSearchParams(path).get('id') ?? 0);
    return buildSamisSuccess(mockQualityCheckState.find((c) => c.id === id) ?? null) as T;
  }
  if (path.endsWith('/quality/checkCreate') && init?.method === 'POST') {
    const body = parseBody<Record<string, unknown>>(init);
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const id = ++mockQualityCheckIdCounter.value;
    const row = {
      id,
      checkItem: String(body.checkItem ?? ''),
      standard: body.standard ? String(body.standard) : null,
      result: String(body.result ?? '待查'),
      checker: body.checker ? String(body.checker) : null,
      checkDate: body.checkDate ? String(body.checkDate) : null,
      issueDesc: body.issueDesc ? String(body.issueDesc) : null,
      rectifyStatus: String(body.rectifyStatus ?? '待整改'),
      createdAt: now,
      updatedAt: now,
    };
    mockQualityCheckState.unshift(row);
    return buildSamisSuccess(row) as T;
  }
  if (path.endsWith('/quality/checkUpdate') && init?.method === 'POST') {
    const body = parseBody<Record<string, unknown>>(init);
    const row = mockQualityCheckState.find((c) => c.id === Number(body.id ?? 0));
    if (row) {
      for (const key of ['checkItem', 'standard', 'result', 'checker', 'checkDate', 'issueDesc', 'rectifyStatus']) {
        if (body[key] !== undefined) (row as unknown as Record<string, unknown>)[key] = body[key];
      }
      row.updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss');
    }
    return buildSamisSuccess(row ?? null) as T;
  }
  if (path.endsWith('/quality/checkDelete') && init?.method === 'POST') {
    const body = parseBody<{ id?: string }>(init);
    const id = Number(body.id ?? 0);
    const idx = mockQualityCheckState.findIndex((c) => c.id === id);
    if (idx >= 0) mockQualityCheckState.splice(idx, 1);
    return buildSamisSuccess(true) as T;
  }

  // ============ Slice 5 术后管理 ============
  if (path.includes('/postoperative/followupList')) {
    return buildSamisSuccess({
      list: mockFollowupState,
      page: 1,
      page_size: mockFollowupState.length,
      total: mockFollowupState.length,
    }) as T;
  }
  if (path.includes('/postoperative/followupGetById')) {
    const id = Number(getSearchParams(path).get('id') ?? 0);
    const row = mockFollowupState.find((f) => f.id === id);
    return buildSamisSuccess(row ?? null) as T;
  }
  if (path.endsWith('/postoperative/followupCreate') && init?.method === 'POST') {
    const body = parseBody<Record<string, unknown>>(init);
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const id = ++mockFollowupIdCounter.value;
    const row: MockFollowup = {
      id,
      caseId: String(body.operationId ?? body.caseId ?? ''),
      operationId: String(body.operationId ?? body.caseId ?? ''),
      patientName: String(body.patientName ?? '未知患者'),
      followupType: String(body.followupType ?? '术后镇痛随访'),
      followTime: String(body.followTime ?? now),
      vasScore: body.vasScore !== undefined ? Number(body.vasScore) : null,
      nausea: Boolean(body.nausea),
      headache: Boolean(body.headache),
      hoarseness: Boolean(body.hoarseness),
      hoarsenessDurationHours: body.hoarsenessDurationHours !== undefined ? Number(body.hoarsenessDurationHours) : null,
      numbness: Boolean(body.numbness),
      motorDisorder: Boolean(body.motorDisorder),
      awareness: Boolean(body.awareness),
      respiratoryDepression: Boolean(body.respiratoryDepression),
      reintubation: Boolean(body.reintubation),
      transferredIcu: Boolean(body.transferredIcu),
      newComa: Boolean(body.newComa),
      neuroDurationHours: body.neuroDurationHours !== undefined ? Number(body.neuroDurationHours) : null,
      death24h: Boolean(body.death24h),
      deathTime: body.deathTime ? String(body.deathTime) : null,
      advice: body.advice ? String(body.advice) : null,
      createdAt: now,
      updatedAt: now,
    };
    mockFollowupState.unshift(row);
    return buildSamisSuccess(row) as T;
  }
  if (path.endsWith('/postoperative/followupUpdate') && init?.method === 'POST') {
    const body = parseBody<Record<string, unknown>>(init);
    const row = mockFollowupState.find((f) => f.id === Number(body.id ?? 0));
    if (row) {
      const fields = [
        'caseId', 'followupType', 'followTime', 'vasScore', 'nausea', 'headache',
        'hoarseness', 'hoarsenessDurationHours', 'numbness', 'motorDisorder',
        'awareness', 'respiratoryDepression', 'reintubation', 'transferredIcu',
        'newComa', 'neuroDurationHours', 'death24h', 'deathTime', 'advice',
      ];
      for (const key of fields) {
        if (body[key] !== undefined) (row as unknown as Record<string, unknown>)[key] = body[key];
      }
      row.updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss');
    }
    return buildSamisSuccess(row ?? null) as T;
  }
  if (path.endsWith('/postoperative/followupDelete') && init?.method === 'POST') {
    const body = parseBody<{ id?: string }>(init);
    const id = Number(body.id ?? 0);
    const idx = mockFollowupState.findIndex((f) => f.id === id);
    if (idx >= 0) mockFollowupState.splice(idx, 1);
    return buildSamisSuccess({ id }) as T;
  }

  if (path.includes('/postoperative/complicationList')) {
    return buildSamisSuccess({
      list: mockComplicationState,
      page: 1,
      page_size: mockComplicationState.length,
      total: mockComplicationState.length,
    }) as T;
  }
  if (path.includes('/postoperative/complicationGetById')) {
    const id = Number(getSearchParams(path).get('id') ?? 0);
    const row = mockComplicationState.find((c) => c.id === id);
    return buildSamisSuccess(row ?? null) as T;
  }
  if (path.endsWith('/postoperative/complicationCreate') && init?.method === 'POST') {
    const body = parseBody<Record<string, unknown>>(init);
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const id = ++mockComplicationIdCounter.value;
    const row: MockComplication = {
      id,
      caseId: String(body.caseId ?? ''),
      operationId: String(body.caseId ?? ''),
      patientName: String(body.patientName ?? '未知患者'),
      type: String(body.complicationType ?? '其他'),
      severity: String(body.severity ?? '中度'),
      stage: body.stage ? String(body.stage) : null,
      symptoms: body.symptoms ? String(body.symptoms) : null,
      treatment: body.treatment ? String(body.treatment) : null,
      outcome: body.outcome ? String(body.outcome) : null,
      reportTime: String(body.reportTime ?? now),
      status: String(body.status ?? '草稿'),
      createdAt: now,
      updatedAt: now,
    };
    mockComplicationState.unshift(row);
    return buildSamisSuccess(row) as T;
  }
  if (path.endsWith('/postoperative/complicationUpdate') && init?.method === 'POST') {
    const body = parseBody<Record<string, unknown>>(init);
    const row = mockComplicationState.find((c) => c.id === Number(body.id ?? 0));
    if (row) {
      const map: Record<string, string> = {
        complicationType: 'type',
        severity: 'severity',
        stage: 'stage',
        symptoms: 'symptoms',
        treatment: 'treatment',
        outcome: 'outcome',
        reportTime: 'reportTime',
        status: 'status',
      };
      for (const [src, dst] of Object.entries(map)) {
        if (body[src] !== undefined) (row as unknown as Record<string, unknown>)[dst] = body[src];
      }
      row.updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss');
    }
    return buildSamisSuccess(row ?? null) as T;
  }
  if (path.endsWith('/postoperative/complicationDelete') && init?.method === 'POST') {
    const body = parseBody<{ id?: string }>(init);
    const id = Number(body.id ?? 0);
    const idx = mockComplicationState.findIndex((c) => c.id === id);
    if (idx >= 0) mockComplicationState.splice(idx, 1);
    return buildSamisSuccess({ id }) as T;
  }

  if (path.includes('/postoperative/analgesiaCases')) {
    const list = anesthesiaCases.filter((c) => c.postoperativeAnalgesia).map(caseToSummary);
    return buildSamisSuccess({ list, page: 1, page_size: list.length, total: list.length }) as T;
  }
  if (path.includes('/postoperative/unplannedCases')) {
    const UNPLANNED = ['非计划转ICU', '非计划二次插管', '心脏骤停', '严重过敏'];
    const list = anesthesiaCases
      .filter(
        (c) =>
          c.transferIcuPlanned ||
          c.transferTo === 'ICU' ||
          c.events.some((e) => UNPLANNED.includes(e.type) || (e.type.includes('非计划') && e.qualityIncluded)),
      )
      .map(caseToSummary);
    return buildSamisSuccess({ list, page: 1, page_size: list.length, total: list.length }) as T;
  }

  // ============ Slice 7 术前管理 ============
  // ---- 申请接收 ----
  if (path.includes('/preoperative/requestList')) {
    const params = getSearchParams(path);
    let list = mockPreopRequestState.slice();
    if (params.get('status')) list = list.filter((r) => r.status === params.get('status'));
    if (params.get('urgency')) list = list.filter((r) => r.urgency === params.get('urgency'));
    if (params.get('department')) list = list.filter((r) => r.department === params.get('department'));
    return buildSamisSuccess({ list, page: 1, page_size: list.length, total: list.length }) as T;
  }
  if (path.includes('/preoperative/requestGetById')) {
    const id = Number(getSearchParams(path).get('id') ?? 0);
    const row = mockPreopRequestState.find((r) => r.id === id) ?? null;
    return row ? buildSamisSuccess(row) as T : buildSamisError('手术申请不存在', 1300) as T;
  }
  if (path.endsWith('/preoperative/requestCreate') && init?.method === 'POST') {
    const body = parseBody<Record<string, unknown>>(init);
    const operationId = body.operationId ? String(body.operationId) : '';
    if (operationId && mockPreopRequestState.some((r) => r.operationId === operationId)) {
      return buildSamisError('该手术已存在申请记录，不可重复创建', 1301) as T;
    }
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const row: MockPreopRequest = {
      id: ++mockPreopRequestIdCounter.value,
      operationId: operationId || `OP-${Date.now()}`,
      patientName: null, department: null, surgeryName: null, surgeon: null,
      urgency: '择期', requestDate: dayjs().format('YYYY-MM-DD'),
      status: '待接收', receivedAt: null, receivedBy: null, remark: null,
      createdAt: now, updatedAt: now,
    };
    for (const key of ['patientName', 'department', 'surgeryName', 'surgeon', 'urgency', 'requestDate', 'remark']) {
      if (body[key] !== undefined) (row as unknown as Record<string, unknown>)[key] = body[key];
    }
    mockPreopRequestState.unshift(row);
    return buildSamisSuccess(row) as T;
  }
  if (path.endsWith('/preoperative/requestUpdate') && init?.method === 'POST') {
    const body = parseBody<Record<string, unknown>>(init);
    const row = mockPreopRequestState.find((r) => r.id === Number(body.id ?? 0));
    if (row) {
      for (const key of ['patientName', 'department', 'surgeryName', 'surgeon', 'urgency', 'requestDate', 'remark']) {
        if (body[key] !== undefined) (row as unknown as Record<string, unknown>)[key] = body[key];
      }
      row.updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss');
    }
    return row ? buildSamisSuccess(row) as T : buildSamisError('手术申请不存在', 1300) as T;
  }
  if (path.endsWith('/preoperative/requestReceive') && init?.method === 'POST') {
    const body = parseBody<{ id?: string }>(init);
    const row = mockPreopRequestState.find((r) => r.id === Number(body.id ?? 0));
    if (!row) return buildSamisError('手术申请不存在', 1300) as T;
    if (row.status !== '待接收') return buildSamisError('该申请已处理（已排班/已取消），不可重复接收', 1302) as T;
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    row.status = '已排班'; row.receivedAt = now; row.receivedBy = '演示用户'; row.updatedAt = now;
    return buildSamisSuccess(row) as T;
  }
  if (path.endsWith('/preoperative/requestCancel') && init?.method === 'POST') {
    const body = parseBody<{ id?: string }>(init);
    const row = mockPreopRequestState.find((r) => r.id === Number(body.id ?? 0));
    if (!row) return buildSamisError('手术申请不存在', 1300) as T;
    if (row.status === '已取消') return buildSamisError('该申请已取消，不可重复取消', 1302) as T;
    row.status = '已取消'; row.updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss');
    return buildSamisSuccess(row) as T;
  }

  // ---- 麻醉会诊（一 case 多条）----
  if (path.includes('/preoperative/consultationList')) {
    const params = getSearchParams(path);
    let list = mockPreopConsultationState.slice();
    if (params.get('caseId')) list = list.filter((r) => r.caseId === params.get('caseId'));
    if (params.get('status')) list = list.filter((r) => r.status === params.get('status'));
    return buildSamisSuccess({ list, page: 1, page_size: list.length, total: list.length }) as T;
  }
  if (path.includes('/preoperative/consultationGetById')) {
    const id = Number(getSearchParams(path).get('id') ?? 0);
    return buildSamisSuccess(mockPreopConsultationState.find((r) => r.id === id) ?? null) as T;
  }
  if (path.endsWith('/preoperative/consultationCreate') && init?.method === 'POST') {
    const body = parseBody<Record<string, unknown>>(init);
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const row: MockPreopConsultation = {
      id: ++mockPreopConsultationIdCounter.value,
      caseId: String(body.caseId ?? ''),
      operationId: String(body.caseId ?? ''),
      patientName: body.patientName ? String(body.patientName) : null,
      requestDept: body.requestDept ? String(body.requestDept) : null,
      consultDate: body.consultDate ? String(body.consultDate) : null,
      consultant: body.consultant ? String(body.consultant) : null,
      opinion: body.opinion ? String(body.opinion) : null,
      status: String(body.status ?? '待会诊'),
      createdAt: now, updatedAt: now,
    };
    mockPreopConsultationState.unshift(row);
    return buildSamisSuccess(row) as T;
  }
  if (path.endsWith('/preoperative/consultationUpdate') && init?.method === 'POST') {
    const body = parseBody<Record<string, unknown>>(init);
    const row = mockPreopConsultationState.find((r) => r.id === Number(body.id ?? 0));
    if (row) {
      for (const key of ['patientName', 'requestDept', 'consultDate', 'consultant', 'opinion', 'status']) {
        if (body[key] !== undefined) (row as unknown as Record<string, unknown>)[key] = body[key];
      }
      row.updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss');
    }
    return buildSamisSuccess(row ?? null) as T;
  }

  // ---- 检查审核（一 case 多条）----
  if (path.includes('/preoperative/examReviewList')) {
    const params = getSearchParams(path);
    let list = mockPreopExamReviewState.slice();
    if (params.get('caseId')) list = list.filter((r) => r.caseId === params.get('caseId'));
    if (params.get('reviewResult')) list = list.filter((r) => r.reviewResult === params.get('reviewResult'));
    return buildSamisSuccess({ list, page: 1, page_size: list.length, total: list.length }) as T;
  }
  if (path.includes('/preoperative/examReviewGetById')) {
    const id = Number(getSearchParams(path).get('id') ?? 0);
    return buildSamisSuccess(mockPreopExamReviewState.find((r) => r.id === id) ?? null) as T;
  }
  if (path.endsWith('/preoperative/examReviewCreate') && init?.method === 'POST') {
    const body = parseBody<Record<string, unknown>>(init);
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const row: MockPreopExamReview = {
      id: ++mockPreopExamReviewIdCounter.value,
      caseId: String(body.caseId ?? ''),
      operationId: String(body.caseId ?? ''),
      patientName: body.patientName ? String(body.patientName) : null,
      labItems: body.labItems ? String(body.labItems) : null,
      imagingItems: body.imagingItems ? String(body.imagingItems) : null,
      reviewResult: String(body.reviewResult ?? '通过'),
      reviewer: body.reviewer ? String(body.reviewer) : null,
      reviewDate: body.reviewDate ? String(body.reviewDate) : null,
      createdAt: now, updatedAt: now,
    };
    mockPreopExamReviewState.unshift(row);
    return buildSamisSuccess(row) as T;
  }
  if (path.endsWith('/preoperative/examReviewUpdate') && init?.method === 'POST') {
    const body = parseBody<Record<string, unknown>>(init);
    const row = mockPreopExamReviewState.find((r) => r.id === Number(body.id ?? 0));
    if (row) {
      for (const key of ['patientName', 'labItems', 'imagingItems', 'reviewResult', 'reviewer', 'reviewDate']) {
        if (body[key] !== undefined) (row as unknown as Record<string, unknown>)[key] = body[key];
      }
      row.updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss');
    }
    return buildSamisSuccess(row ?? null) as T;
  }

  // ---- 知情同意（1:1 per case）----
  if (path.includes('/preoperative/consentList')) {
    const params = getSearchParams(path);
    let list = mockPreopConsentState.slice();
    if (params.get('caseId')) list = list.filter((r) => r.caseId === params.get('caseId'));
    if (params.get('status')) list = list.filter((r) => r.status === params.get('status'));
    return buildSamisSuccess({ list, page: 1, page_size: list.length, total: list.length }) as T;
  }
  if (path.includes('/preoperative/consentGetById')) {
    const id = Number(getSearchParams(path).get('id') ?? 0);
    return buildSamisSuccess(mockPreopConsentState.find((r) => r.id === id) ?? null) as T;
  }
  if (path.includes('/preoperative/consentGetByCaseId')) {
    const caseId = getSearchParams(path).get('caseId') ?? '';
    return buildSamisSuccess(mockPreopConsentState.find((r) => r.caseId === caseId) ?? null) as T;
  }
  if (path.endsWith('/preoperative/consentCreate') && init?.method === 'POST') {
    const body = parseBody<Record<string, unknown>>(init);
    const caseId = String(body.operationId ?? body.caseId ?? '');
    if (caseId && mockPreopConsentState.some((r) => r.caseId === caseId)) {
      return buildSamisError('该病例已存在知情同意书，不可重复创建', 1401) as T;
    }
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const row: MockPreopConsent = {
      id: ++mockPreopConsentIdCounter.value,
      caseId,
      operationId: caseId,
      patientName: body.patientName ? String(body.patientName) : null,
      surgeryName: body.surgeryName ? String(body.surgeryName) : null,
      anesthesiaMethod: body.anesthesiaMethod ? String(body.anesthesiaMethod) : null,
      surgeryDate: body.surgeryDate ? String(body.surgeryDate) : null,
      commonRisks: false, severeRisks: false, specialRisks: false, planAccepted: false,
      questionAnswered: false, patientSigned: false, familySigned: false, doctorSigned: false,
      signedAt: null, status: '草稿', createdAt: now, updatedAt: now,
    };
    mockPreopConsentState.unshift(row);
    return buildSamisSuccess(row) as T;
  }
  if (path.endsWith('/preoperative/consentUpdate') && init?.method === 'POST') {
    const body = parseBody<{ id?: string; [k: string]: unknown }>(init);
    const row = mockPreopConsentState.find((r) => r.id === Number(body.id ?? 0));
    if (!row) return buildSamisError('知情同意书不存在', 1400) as T;
    if (row.status === '已提交') return buildSamisError('该知情同意书已提交，不可修改', 1402) as T;
    for (const key of ['patientName', 'surgeryName', 'anesthesiaMethod', 'surgeryDate']) {
      if (body[key] !== undefined) (row as unknown as Record<string, unknown>)[key] = body[key];
    }
    for (const key of ['commonRisks', 'severeRisks', 'specialRisks', 'planAccepted', 'questionAnswered', 'patientSigned', 'familySigned', 'doctorSigned']) {
      if (body[key] !== undefined) (row as unknown as Record<string, boolean>)[key] = Boolean(body[key]);
    }
    row.updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss');
    return buildSamisSuccess(row) as T;
  }
  if (path.endsWith('/preoperative/consentSubmit') && init?.method === 'POST') {
    const body = parseBody<{ id?: string }>(init);
    const row = mockPreopConsentState.find((r) => r.id === Number(body.id ?? 0));
    if (!row) return buildSamisError('知情同意书不存在', 1400) as T;
    if (row.status === '已提交') return buildSamisError('该知情同意书已提交，不可重复提交', 1402) as T;
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    row.status = '已提交'; row.signedAt = now; row.updatedAt = now;
    return buildSamisSuccess(row) as T;
  }

  // ---- 安全核查（1:1 per case）----
  if (path.includes('/preoperative/safetyCheckList')) {
    const params = getSearchParams(path);
    let list = mockPreopSafetyCheckState.slice();
    if (params.get('caseId')) list = list.filter((r) => r.caseId === params.get('caseId'));
    if (params.get('status')) list = list.filter((r) => r.status === params.get('status'));
    return buildSamisSuccess({ list, page: 1, page_size: list.length, total: list.length }) as T;
  }
  if (path.includes('/preoperative/safetyCheckGetById')) {
    const id = Number(getSearchParams(path).get('id') ?? 0);
    return buildSamisSuccess(mockPreopSafetyCheckState.find((r) => r.id === id) ?? null) as T;
  }
  if (path.includes('/preoperative/safetyCheckGetByCaseId')) {
    const caseId = getSearchParams(path).get('caseId') ?? '';
    return buildSamisSuccess(mockPreopSafetyCheckState.find((r) => r.caseId === caseId) ?? null) as T;
  }
  if (path.endsWith('/preoperative/safetyCheckCreate') && init?.method === 'POST') {
    const body = parseBody<{ caseId?: string; [k: string]: unknown }>(init);
    if (body.caseId && mockPreopSafetyCheckState.some((r) => r.caseId === body.caseId)) {
      return buildSamisError('该病例已存在安全核查记录，不可重复创建', 1501) as T;
    }
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const signIn = Boolean(body.signInComplete);
    const timeOut = Boolean(body.timeOutComplete);
    const signOut = Boolean(body.signOutComplete);
    const row: MockPreopSafetyCheck = {
      id: ++mockPreopSafetyCheckIdCounter.value,
      caseId: String(body.caseId ?? ''),
      operationId: String(body.caseId ?? ''),
      patientName: body.patientName ? String(body.patientName) : null,
      signInComplete: signIn,
      timeOutComplete: timeOut,
      signOutComplete: signOut,
      checker: body.checker ? String(body.checker) : null,
      checkDate: body.checkDate ? String(body.checkDate) : null,
      status: signIn && timeOut && signOut ? '已完成' : '未完成',
      createdAt: now, updatedAt: now,
    };
    mockPreopSafetyCheckState.unshift(row);
    return buildSamisSuccess(row) as T;
  }
  if (path.endsWith('/preoperative/safetyCheckUpdate') && init?.method === 'POST') {
    const body = parseBody<{ id?: string; [k: string]: unknown }>(init);
    const row = mockPreopSafetyCheckState.find((r) => r.id === Number(body.id ?? 0));
    if (row) {
      for (const key of ['signInComplete', 'timeOutComplete', 'signOutComplete']) {
        if (body[key] !== undefined) (row as unknown as Record<string, boolean>)[key] = Boolean(body[key]);
      }
      for (const key of ['patientName', 'checker', 'checkDate']) {
        if (body[key] !== undefined) (row as unknown as Record<string, unknown>)[key] = body[key];
      }
      row.status = row.signInComplete && row.timeOutComplete && row.signOutComplete ? '已完成' : '未完成';
      row.updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss');
    }
    return buildSamisSuccess(row ?? null) as T;
  }

  throw new Error(`Mock backend route not implemented: ${path}`);
}
