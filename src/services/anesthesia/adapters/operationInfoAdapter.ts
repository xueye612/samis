import type { CaseStatus, SurgeryCase } from '@/types/anesthesia';
import type { AnesthesiaRecordSnapshot } from '@/types/anesthesiaRecord';
import { buildRecordSnapshot } from '@/services/anesthesiaRecordEngine';
import { pickField, pickNumber, pickString, unwrapListPayload } from '@/services/anesthesia/adapters/fieldUtils';
export interface OperationListQuery {
  operationDate?: string;
  date?: string;
  room?: string;
  roomId?: string;
  operationRoom?: string;
  patientName?: string;
  patientNumber?: string;
  inpatientNo?: string;
  page?: number;
  pageSize?: number;
}

export interface NursePbListQuery {
  startTime: string;
  endTime: string;
}

export interface OperationInfoQuery {
  operationId?: string;
  OPERATIONID?: string;
  patientNumber?: string;
}

export interface WorkbenchRoomStatus {
  roomId: string;
  roomName: string;
  busy: boolean;
  count: number;
}

export interface WorkbenchSummary {
  surgeries: number;
  busyRooms: number;
  roomCount: number;
  canceled: number;
  operationDate?: string;
}

export type OperationDetailDto = Record<string, unknown> & {
  operationId: string;
};

export interface OperationCase {
  // 标识（只读）
  operationId?: string | null;
  patientId?: string | null;
  patientNo?: string | null;
  visitNo?: string | null;
  medicalRecordNo?: string | null;
  // 患者
  patientName?: string | null;
  gender?: string | null;
  birthday?: string | null;
  age?: number | string | null;
  ageUnit?: string | null;
  patientType?: string | null;
  patientTypeName?: string | null;
  height?: number | string | null;
  weight?: number | string | null;
  // 位置
  departmentCode?: string | null;
  departmentName?: string | null;
  wardCode?: string | null;
  wardName?: string | null;
  bedCode?: string | null;
  bedName?: string | null;
  floor?: string | null;
  roomCode?: string | null;
  roomName?: string | null;
  roomGroup?: string | null;
  roomGroupCode?: string | null;
  roomGroupName?: string | null;
  operatingDepartmentCode?: string | null;
  operatingDepartmentName?: string | null;
  // 诊断/手术
  preoperativeDiagnosisCode?: string | null;
  preoperativeDiagnosisName?: string | null;
  plannedOperationCode?: string | null;
  plannedOperationName?: string | null;
  operationCode?: string | null;
  operationName?: string | null;
  operationLevelCode?: string | null;
  operationLevelName?: string | null;
  operationBlade?: string | null;
  operationCombo?: string | null;
  surgeryCategoryCode?: string | null;
  surgeryCategoryName?: string | null;
  // 排班
  operationDate?: string | null;
  plannedStartTime?: string | null;
  plannedEndTime?: string | null;
  sequence?: number | string | null;
  status?: string | null;
  // 人员
  doctorCode?: string | null;
  doctorName?: string | null;
  operatorCode?: string | null;
  operatorName?: string | null;
  surgeonName?: string | null;
  preceptorCode?: string | null;
  preceptorName?: string | null;
  assistantCode?: string | null;
  assistantName?: string | null;
  anesthesiologistCode?: string | null;
  anesthesiologistName?: string | null;
  anesthesiologistAssistantCode?: string | null;
  anesthesiologistAssistantName?: string | null;
  anesthesiologistPbCode?: string | null;
  anesthesiologistPbName?: string | null;
  instrumentNurseCode?: string | null;
  instrumentNurseName?: string | null;
  scrubNurseCode?: string | null;
  scrubNurseName?: string | null;
  circulatingNurseCode?: string | null;
  circulatingNurseName?: string | null;
  anesthesiaMethodCode?: string | null;
  anesthesiaMethodName?: string | null;
  // 风险
  patientBlood?: string | null;
  patientBloodRh?: string | null;
  specialInfect?: string | null;
  infectFlag?: string | null;
  /** 未确认字段：无真实列时必须为 null，禁止补造 II/无 等。 */
  asaClass?: string | null;
  allergyHistory?: string | null;
  transfusionPreparation?: string | null;
  // 状态位
  isEmergency?: boolean | null;
  isTwoStageOperation?: boolean | null;
  isLocked?: boolean | null;
  isArchived?: boolean | null;
  isPrinted?: boolean | null;
  hisIsDelete?: boolean | null;
  canceledReason?: string | null;
  canceledReasonType?: string | null;
  operationEndThereCode?: string | null;
  operationEndThereName?: string | null;
  onComments?: string | null;
  // 元数据
  hisCreatedTime?: string | null;
  createTime?: string | null;
  updateTime?: string | null;
  lastUpdatedAt?: string | null;
  bit?: number | null;
  version?: number | null;
  sourceSystem?: string | null;
  sourceTable?: string | null;
  // 实际时间兼容字段（只读）
  actualInRoomTime?: string | null;
  actualAnesthesiaStartTime?: string | null;
  actualOperationStartTime?: string | null;
  actualOperationEndTime?: string | null;
  actualOutRoomTime?: string | null;
}

export interface OperationTimeline extends Record<string, unknown> {
  inRoomTime?: string;
  anesthesiaStartTime?: string;
  anesthesiaInductionTime?: string;
  airwayEstablishedTime?: string;
  operationStartTime?: string;
  operationEndTime?: string;
  anesthesiaEndTime?: string;
  extubationTime?: string;
  outRoomTime?: string;
  pacuInTime?: string;
  pacuOutTime?: string;
}

const STATUS_MAP: Record<string, CaseStatus> = {
  待入室: '待入室',
  已入室: '已入室',
  麻醉诱导: '麻醉诱导',
  麻醉中: '麻醉中',
  手术中: '手术中',
  苏醒中: '苏醒中',
  PACU: 'PACU',
  已离室: '已离室',
  已取消: '已取消',
};

function mapUrgency(raw: unknown): '急诊' | '择期' {
  const text = String(raw ?? '');
  if (text.includes('急')) return '急诊';
  return '择期';
}

function mapGender(raw: unknown): '男' | '女' {
  const text = String(raw ?? '');
  if (text.includes('女')) return '女';
  return '男';
}

function defaultPreVisit(partial?: Partial<SurgeryCase['preVisit']>): SurgeryCase['preVisit'] {
  return {
    completed: false,
    height: partial?.height ?? 170,
    weight: partial?.weight ?? 65,
    asa: partial?.asa ?? 'II',
    allergy: partial?.allergy ?? '无',
    anesthesiaHistory: partial?.anesthesiaHistory ?? '',
    difficultAirway: partial?.difficultAirway ?? '',
    fasting: partial?.fasting ?? '',
    preMedication: partial?.preMedication ?? '',
    specialCondition: partial?.specialCondition ?? '',
    plan: partial?.plan ?? '',
    doctorSignature: partial?.doctorSignature ?? '',
  };
}

export function emptyClinicalShell(id: string): SurgeryCase {
  return {
    id,
    room: 'OR-01',
    sequence: 1,
    patientName: '未命名',
    gender: '男',
    age: 0,
    department: '',
    diagnosis: '',
    surgeryName: '',
    surgeon: '',
    anesthesiaMethod: '全身麻醉',
    asa: 'II',
    urgency: '择期',
    anesthesiologist: '',
    anesthesiaNurse: '',
    status: '待入室',
    locationType: '手术室内',
    plannedStart: new Date().toISOString(),
    expectedDurationMinutes: 60,
    locked: false,
    activeWarming: false,
    autologousBlood: false,
    postoperativeAnalgesia: false,
    preVisit: defaultPreVisit(),
    vitals: [],
    events: [],
    medications: [],
    fluids: [],
    outputs: { urine: 0, bloodLoss: 0, drainage: 0 },
  };
}

function asRecord<T extends Record<string, unknown> = Record<string, unknown>>(value: unknown): T {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as T : {} as T;
}

function firstDefined(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function normalizeOperationContractFields(raw: unknown): Record<string, unknown> {
  const legacy = asRecord(raw);
  const operationCase = asRecord(legacy.operationCase);
  const operationTimeline = asRecord<OperationTimeline>(legacy.operationTimeline);

  return {
    ...legacy,
    operationId: firstDefined(operationCase.operationId, legacy.operationId, legacy.OPERATIONID, legacy.id),
    patientId: firstDefined(operationCase.patientId, legacy.patientId, legacy.PATIENT_ID),
    patientNumber: firstDefined(operationCase.patientNo, legacy.patientNumber, legacy.PATIENT_NUMBER, legacy.INPATIENTNO, legacy.inpatientNo),
    inpatientNo: firstDefined(operationCase.patientNo, legacy.inpatientNo, legacy.INPATIENTNO),
    patientName: firstDefined(operationCase.patientName, legacy.patientName, legacy.PATIENT_NAME, legacy.PATIENTNAME),
    gender: firstDefined(operationCase.gender, legacy.gender, legacy.sex, legacy.GENDER, legacy.PATIENT_SEX),
    age: firstDefined(operationCase.age, legacy.age, legacy.AGE, legacy.PATIENT_AGE),
    department: firstDefined(operationCase.departmentName, legacy.department, legacy.deptName, legacy.DEPTNAME, legacy.PATIENT_DEPARTMENT_NAME, legacy.PATIENT_DEPARTMENT_CODE),
    room: firstDefined(operationCase.roomName, legacy.room, legacy.roomName, legacy.ROOMNAME, legacy.OPERATINGROOM_CODE),
    roomName: firstDefined(operationCase.roomName, legacy.roomName, legacy.ROOMNAME, legacy.OPERATINGROOM_CODE),
    operationName: firstDefined(operationCase.operationName, legacy.operationName, legacy.OPERATION_NAME, legacy.OPERATIONNAME),
    operationDate: firstDefined(operationCase.operationDate, legacy.operationDate, legacy.OPERATIONDATE),
    sequence: firstDefined(operationCase.sequence, legacy.sequence, legacy.numberOfStations, legacy.NUMBER_OF_STATIONS, legacy.stationNo),
    status: firstDefined(operationCase.status, legacy.status, legacy.operationStatus, legacy.OPERATION_STATUS, legacy.recordStatus),
    surgeonName: firstDefined(operationCase.surgeonName, legacy.surgeonName, legacy.surgeon, legacy.SURGEON, legacy.DOCTOR_NAME, legacy.OPERATOR_NAME),
    anesthesiologist: firstDefined(operationCase.anesthesiologistName, legacy.anesthesiologist, legacy.anesDoctor, legacy.ANESTHESIOLOGIST, legacy.ANESTHETIST_NAME, legacy.ANESTHETIST_PB_NAME),
    circulatingNurses: firstDefined(operationCase.circulatingNurseName, legacy.circulatingNurses, legacy.circulatingNurse, legacy.CIRCULATINGNURSE_NAME),
    scrubNurses: firstDefined(operationCase.scrubNurseName, legacy.scrubNurses, legacy.scrubNurse, legacy.SCRUBNURSE_NAME),
    plannedStart: firstDefined(operationCase.plannedStartTime, legacy.plannedStart, legacy.PLANNING_BEGINTIME),
    actualStart: firstDefined(operationTimeline.inRoomTime, operationCase.actualInRoomTime, legacy.actualStart, legacy.roomInTime, legacy.ENTER_ROOM_TIME, legacy.FIRST_SCANNING),
    roomInTime: firstDefined(operationTimeline.inRoomTime, operationCase.actualInRoomTime, legacy.roomInTime, legacy.actualStart, legacy.ENTER_ROOM_TIME, legacy.FIRST_SCANNING),
    anesthesiaStart: firstDefined(operationTimeline.anesthesiaStartTime, operationCase.actualAnesthesiaStartTime, legacy.anesthesiaStart, legacy.ANESTHESIA_START_TIME),
    surgeryStart: firstDefined(operationTimeline.operationStartTime, operationCase.actualOperationStartTime, legacy.surgeryStart, legacy.OPERATION_START_TIME),
    surgeryEnd: firstDefined(operationTimeline.operationEndTime, operationCase.actualOperationEndTime, legacy.surgeryEnd, legacy.OPERATION_END_TIME, legacy.PLANNING_ENDTIME),
    anesthesiaEnd: firstDefined(operationTimeline.anesthesiaEndTime, legacy.anesthesiaEnd, legacy.ANESTHESIA_END_TIME),
    leaveRoomTime: firstDefined(operationTimeline.outRoomTime, operationCase.actualOutRoomTime, legacy.leaveRoomTime, legacy.LEAVE_ROOM_TIME, legacy.LAST_SCANNING),
  };
}

/**
 * 构建规范 operationCase（权威主数据）。优先嵌套 operationCase，回退 legacy 平铺字段；
 * 缺失字段为 undefined，禁止补造性别/ASA/过敏史等默认值。来源元数据固定 HULI/operatenotice。
 */
/** 规范字段来源映射：canonical => 按优先级排列的源键（与后端 OperationCaseService 对齐）。 */
const CASE_FIELD_SOURCES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['operationId', ['operationId', 'OPERATIONID', 'id']],
  ['patientId', ['patientId', 'PATIENT_ID']],
  ['patientNo', ['patientNo', 'PATIENT_NUMBER', 'patientNumber', 'INPATIENTNO']],
  ['visitNo', ['visitNo', 'PATIENT_VISIT_NO']],
  ['medicalRecordNo', ['medicalRecordNo', 'PATIENT_MRN']],
  ['patientName', ['patientName', 'PATIENT_NAME', 'PATIENTNAME']],
  ['gender', ['gender', 'sex', 'PATIENT_SEX']],
  ['birthday', ['birthday', 'PATIENT_BIRTHDAY']],
  ['age', ['age', 'AGE', 'PATIENT_AGE']],
  ['ageUnit', ['ageUnit', 'PATIENT_AGEUNIT']],
  ['patientType', ['patientType', 'PATIENT_TYPE']],
  ['patientTypeName', ['patientTypeName', 'PATIENT_TYPE_NAME']],
  ['height', ['height', 'PATIENT_HEIGHT']],
  ['weight', ['weight', 'PATIENT_WEIGHT']],
  ['departmentCode', ['departmentCode', 'PATIENT_DEPARTMENT_CODE']],
  ['departmentName', ['departmentName', 'department', 'PATIENT_DEPARTMENT_NAME', 'OPERATINGDEPT_NAME']],
  ['wardCode', ['wardCode', 'PATIENT_WARD_CODE']],
  ['wardName', ['wardName', 'PATIENT_WARD_NAME']],
  ['bedCode', ['bedCode', 'PATIENT_BED_CODE']],
  ['bedName', ['bedName', 'PATIENT_BED_NAME']],
  ['floor', ['floor', 'PATIENT_FLOOR']],
  ['roomCode', ['roomCode', 'OPERATINGROOM_CODE']],
  ['roomName', ['roomName', 'room', 'ROOMNAME', 'OPERATINGROOM_NAME']],
  ['roomGroup', ['roomGroup', 'ROOM_GROUP_NAME', 'ROOM_GROUP']],
  ['roomGroupCode', ['roomGroupCode', 'ROOM_GROUP']],
  ['roomGroupName', ['roomGroupName', 'ROOM_GROUP_NAME', 'ROOM_GROUP']],
  ['operatingDepartmentCode', ['operatingDepartmentCode', 'OPERATINGDEPT_CODE']],
  ['operatingDepartmentName', ['operatingDepartmentName', 'OPERATINGDEPT_NAME', 'PATIENT_DEPARTMENT_NAME']],
  ['preoperativeDiagnosisCode', ['preoperativeDiagnosisCode', 'PREOPERATIVE_DIAGNOSIS_CODE']],
  ['preoperativeDiagnosisName', ['preoperativeDiagnosisName', 'diagnosis', 'PREOPERATIVE_DIAGNOSIS_NAME']],
  ['plannedOperationCode', ['plannedOperationCode', 'PLAN_OPERATION_CODE']],
  ['plannedOperationName', ['plannedOperationName', 'PLAN_OPERATION_NAME']],
  ['operationCode', ['operationCode', 'OPERATION_CODE']],
  ['operationName', ['operationName', 'surgeryName', 'OPERATION_NAME', 'OPERATIONNAME']],
  ['operationLevelCode', ['operationLevelCode', 'OPERATIONLEVEL_CODE']],
  ['operationLevelName', ['operationLevelName', 'OPERATIONLEVEL_NAME']],
  ['operationBlade', ['operationBlade', 'OPERATION_BLADE']],
  ['operationCombo', ['operationCombo', 'OPERATION_COMBO']],
  ['surgeryCategoryCode', ['surgeryCategoryCode', 'SHOUSHULB']],
  ['surgeryCategoryName', ['surgeryCategoryName', 'SHOUSHULB_NAME']],
  ['operationDate', ['operationDate', 'OPERATIONDATE']],
  ['plannedStartTime', ['plannedStartTime', 'PLANNING_BEGINTIME']],
  ['plannedEndTime', ['plannedEndTime', 'PLANNING_ENDTIME']],
  ['sequence', ['sequence', 'NUMBER_OF_STATIONS', 'numberOfStations']],
  ['status', ['status', 'OPERATION_STATUS', 'OPERATION_STATUS_NAME']],
  ['doctorCode', ['doctorCode', 'DOCTOR_CODE']],
  ['doctorName', ['doctorName', 'DOCTOR_NAME']],
  ['operatorCode', ['operatorCode', 'OPERATOR_CODE']],
  ['operatorName', ['operatorName', 'OPERATOR_NAME']],
  ['surgeonName', ['surgeonName', 'surgeon', 'SURGEON', 'OPERATOR_NAME', 'DOCTOR_NAME']],
  ['preceptorCode', ['preceptorCode', 'PRECEPTOR_CODE']],
  ['preceptorName', ['preceptorName', 'PRECEPTOR_NAME']],
  ['assistantCode', ['assistantCode', 'ASSISTANT_CODE']],
  ['assistantName', ['assistantName', 'ASSISTANT_NAME']],
  ['anesthesiologistCode', ['anesthesiologistCode', 'ANESTHETIST_CODE']],
  ['anesthesiologistName', ['anesthesiologistName', 'anesthesiologist', 'ANESTHETIST_NAME', 'ANESTHETIST_PB_NAME']],
  ['anesthesiologistAssistantCode', ['anesthesiologistAssistantCode', 'ANESTHETIST_ASSISTANT_CODE']],
  ['anesthesiologistAssistantName', ['anesthesiologistAssistantName', 'ANESTHETIST_ASSISTANT_NAME']],
  ['anesthesiologistPbCode', ['anesthesiologistPbCode', 'ANESTHETIST_PB_CODE']],
  ['anesthesiologistPbName', ['anesthesiologistPbName', 'ANESTHETIST_PB_NAME']],
  ['instrumentNurseCode', ['instrumentNurseCode', 'INSTRUMENTNURSE_CODE']],
  ['instrumentNurseName', ['instrumentNurseName', 'INSTRUMENTNURSE_NAME']],
  ['scrubNurseCode', ['scrubNurseCode', 'SCRUBNURSE_CODE']],
  ['scrubNurseName', ['scrubNurseName', 'SCRUBNURSE_NAME', 'INSTRUMENTNURSE_NAME']],
  ['circulatingNurseCode', ['circulatingNurseCode', 'CIRCULATINGNURSE_CODE']],
  ['circulatingNurseName', ['circulatingNurseName', 'CIRCULATINGNURSE_NAME']],
  ['anesthesiaMethodCode', ['anesthesiaMethodCode', 'ANESTHESIA_METHOD_CODE']],
  ['anesthesiaMethodName', ['anesthesiaMethodName', 'anesthesiaMethod', 'ANESTHESIA_METHOD_NAME']],
  ['patientBlood', ['patientBlood', 'PATIENT_BLOOD']],
  ['patientBloodRh', ['patientBloodRh', 'PATIENT_BLOODRH']],
  ['specialInfect', ['specialInfect', 'SPECIAL_INFECT']],
  ['infectFlag', ['infectFlag', 'INFECT_FLAG']],
  ['asaClass', ['asaClass', 'asa']],
  ['allergyHistory', ['allergyHistory', 'allergy']],
  ['transfusionPreparation', ['transfusionPreparation']],
  ['isEmergency', ['isEmergency', 'ISEMERGENCY']],
  ['isTwoStageOperation', ['isTwoStageOperation', 'ISTWO_PLAN_OPERATION']],
  ['isLocked', ['isLocked', 'ISLOCKING']],
  ['isArchived', ['isArchived', 'ISARCHIVE']],
  ['isPrinted', ['isPrinted', 'ISPRINTED']],
  ['hisIsDelete', ['hisIsDelete', 'HIS_ISDELETE']],
  ['canceledReason', ['canceledReason', 'CANCELED_REASON']],
  ['canceledReasonType', ['canceledReasonType', 'CANCELED_REASON_TYPE']],
  ['operationEndThereCode', ['operationEndThereCode', 'OPERATION_END_THERE_CODE']],
  ['operationEndThereName', ['operationEndThereName', 'OPERATION_END_THERE_NAME']],
  ['onComments', ['onComments', 'ON_COMMENTS']],
  ['hisCreatedTime', ['hisCreatedTime', 'HIS_CREATEDT']],
  ['createTime', ['createTime', 'CREATE_TIME']],
  ['updateTime', ['updateTime', 'UPDATE_TIME']],
  ['actualInRoomTime', ['actualInRoomTime', 'FIRST_SCANNING']],
  ['actualAnesthesiaStartTime', ['actualAnesthesiaStartTime', 'ANESTHESIA_START_TIME']],
  ['actualOperationStartTime', ['actualOperationStartTime', 'OPERATION_START_TIME']],
  ['actualOperationEndTime', ['actualOperationEndTime', 'OPERATION_END_TIME']],
  ['actualOutRoomTime', ['actualOutRoomTime', 'LAST_SCANNING']],
];

const CASE_INT_FIELDS = new Set(['sequence', 'bit']);
const CASE_BOOL_FIELDS = new Set([
  'isEmergency', 'isTwoStageOperation', 'isLocked', 'isArchived', 'isPrinted', 'hisIsDelete',
]);

/** 显式布尔转换：0/'0'/false/'false' → false；1/'1'/true/'true' → true；其余 → null。不得使用 Boolean('0')。 */
function toNullableBool(value: unknown): boolean | null {
  if (value === 0 || value === '0' || value === false || value === 'false') return false;
  if (value === 1 || value === '1' || value === true || value === 'true') return true;
  return null;
}

function normalizeCaseScalar(canonical: string, value: unknown): unknown {
  if (CASE_INT_FIELDS.has(canonical)) {
    return value === undefined || value === null || value === '' ? null : Number(value);
  }
  if (CASE_BOOL_FIELDS.has(canonical)) {
    return toNullableBool(value);
  }
  return value;
}

/**
 * 构建规范 operationCase（权威主数据）。优先嵌套 operationCase：字段存在（含 null）即取值，
 * 不再回退旧值；字段不存在时才兼容旧平铺字段。缺失字段保持 undefined，
 * 禁止补造性别/ASA/过敏史/时间/版本等默认值。来源元数据读取服务端值，无值时回退权威默认。
 */
export function buildCanonicalOperationCase(detail: OperationDetailDto): OperationCase {
  const nested = asRecord(detail.operationCase);
  const legacy = detail;
  const has = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);
  const pick = (sources: readonly string[]): unknown => {
    for (const key of sources) {
      if (has(nested, key)) return nested[key];
    }
    for (const key of sources) {
      if (has(legacy, key)) {
        const v = legacy[key];
        if (v !== null && v !== undefined && v !== '') return v;
      }
    }
    return undefined;
  };

  const acc: Record<string, unknown> = {};
  for (const [canonical, sources] of CASE_FIELD_SOURCES) {
    acc[canonical] = normalizeCaseScalar(canonical, pick(sources));
  }
  const versionRaw = pick(['version', 'UPDATE_NUM']);
  acc.version = versionRaw === undefined || versionRaw === null || versionRaw === '' ? null : Number(versionRaw);
  const bitRaw = pick(['bit', 'BIT']);
  acc.bit = bitRaw === undefined || bitRaw === null || bitRaw === '' ? null : Number(bitRaw);
  // 来源元数据只读取服务端值，缺失为 undefined、服务端 null 保持 null，不补造 HULI/operatenotice
  acc.sourceSystem = pick(['sourceSystem']);
  acc.sourceTable = pick(['sourceTable']);
  acc.lastUpdatedAt = pick(['lastUpdatedAt', 'updateTime', 'UPDATE_TIME']);
  return acc as OperationCase;
}

/** 远端（operatenotice）主数据键：合并时远端非空值胜出。 */
export const REMOTE_MASTER_KEYS = [
  'id', 'patientId', 'patientName', 'gender', 'age', 'department', 'diagnosis',
  'surgeryName', 'surgeon', 'anesthesiaMethod', 'urgency', 'anesthesiologist',
  'anesthesiaNurse', 'circulatingNurses', 'scrubNurses', 'room', 'roomId', 'roomName',
  'sequence', 'operationCase',
] as const;

/** 本地（IndexedDB）临床记录键：合并时本地值胜出。 */
export const LOCAL_CLINICAL_KEYS = [
  'vitals', 'events', 'medications', 'fluids', 'outputs', 'outputRecords', 'recordDocument',
  'recordSnapshot', 'labResults', 'transfusionEvents', 'ioRecords', 'recordSummary',
  'layoutWarnings', 'preVisit', 'rescue', 'airwayRecord', 'recoveryRecord', 'anesthesiaPlanes',
  'device', 'signatures', 'modificationLogs', 'recordDraft', 'professionalFieldValues',
  'printedAt', 'locked', 'status', 'recordStatus',
] as const;

/** 权威 operationCase 字段 → 页面使用的平铺展示投影：远端 null 表示权威清空，必须覆盖本地/默认旧值。 */
function syncFlatFromAuthoritative(result: SurgeryCase, oc: OperationCase): void {
  const isEmpty = (v: unknown): boolean => v === null || v === undefined || v === '';
  const toStr = (v: unknown): string => (isEmpty(v) ? '' : String(v));
  const toNum = (v: unknown): number => (isEmpty(v) ? 0 : Number(v));
  const toGender = (v: unknown): '男' | '女' | '' => (v === '男' ? '男' : v === '女' ? '女' : '');
  const has = (k: string): boolean => Object.prototype.hasOwnProperty.call(oc, k);
  if (has('patientName')) result.patientName = toStr(oc.patientName);
  if (has('gender')) result.gender = toGender(oc.gender);
  if (has('age')) result.age = toNum(oc.age);
  if (has('departmentName')) result.department = toStr(oc.departmentName);
  if (has('preoperativeDiagnosisName')) result.diagnosis = toStr(oc.preoperativeDiagnosisName);
  if (has('operationName')) result.surgeryName = toStr(oc.operationName);
  if (has('surgeonName')) result.surgeon = toStr(oc.surgeonName);
  if (has('anesthesiologistName')) result.anesthesiologist = toStr(oc.anesthesiologistName);
  if (has('anesthesiaMethodName')) result.anesthesiaMethod = toStr(oc.anesthesiaMethodName);
  if (has('roomCode')) result.roomId = toStr(oc.roomCode);
  if (has('roomName')) {
    const roomDisplay = toStr(oc.roomName);
    result.room = roomDisplay;
    result.roomName = roomDisplay;
  }
  if (has('sequence')) result.sequence = toNum(oc.sequence);
  if (has('plannedStartTime')) {
    result.plannedStart = toStr(oc.plannedStartTime);
    result.scheduledStart = toStr(oc.plannedStartTime);
  }
  if (has('plannedEndTime')) result.scheduledEnd = toStr(oc.plannedEndTime);
  if (has('circulatingNurseName')) {
    result.anesthesiaNurse = toStr(oc.circulatingNurseName);
    result.circulatingNurses = toStr(oc.circulatingNurseName);
  }
  if (has('scrubNurseName')) result.scrubNurses = toStr(oc.scrubNurseName);
  // ASA/过敏史：权威空值必须清除展示壳旧默认值（II/无），canonical 字段保持 null/undefined
  if (has('asaClass')) {
    const asa = toStr(oc.asaClass);
    result.asa = asa;
    result.preVisit = { ...result.preVisit, asa };
  }
  if (has('allergyHistory')) {
    result.preVisit = { ...result.preVisit, allergy: toStr(oc.allergyHistory) };
  }
}

/**
 * 分层合并：远端主数据（患者/手术/排班/人员/版本 + 规范 operationCase）胜出，
 * 本地临床记录（vitals/events/medications/fluids/recordDocument 等）胜出。
 * 远端返回 null 表示权威清空，必须覆盖本地旧值。禁止用整对象日期比较决定覆盖方向。
 */
export function mergeRemoteMasterWithLocalClinical(remote: SurgeryCase, local: SurgeryCase): SurgeryCase {
  const result: SurgeryCase = { ...local };
  for (const key of REMOTE_MASTER_KEYS) {
    const value = remote[key as keyof SurgeryCase];
    if (value !== undefined && value !== null && value !== '') {
      (result as unknown as Record<string, unknown>)[key] = value;
    }
  }
  if (remote.operationCase !== undefined) {
    result.operationCase = remote.operationCase;
    syncFlatFromAuthoritative(result, remote.operationCase);
  } else if (local.operationCase !== undefined) {
    result.operationCase = local.operationCase;
  }
  return result;
}

export function mapOperationDetail(raw: unknown): OperationDetailDto {
  const normalized = normalizeOperationContractFields(raw);
  const operationId = pickString(normalized, ['operationId', 'OPERATIONID', 'id'], '');
  return {
    ...normalized,
    operationId,
  };
}

export function mapOperationListItem(raw: unknown, index = 0): SurgeryCase {
  const detail = mapOperationDetail(raw);
  const id = detail.operationId || `operation-${index}`;
  const base = emptyClinicalShell(id);
  const merged = mergeOperationIntoCase(base, detail);
  merged.operationCase = buildCanonicalOperationCase(detail);
  // 构建 canonical 后立即用完整权威投影同步首次列表平铺字段；权威 null 清空默认值
  syncFlatFromAuthoritative(merged, merged.operationCase);
  return merged;
}

export function mapOperationListResponse(data: unknown): SurgeryCase[] {
  return unwrapListPayload(data).map((row, index) => mapOperationListItem(row, index));
}

/** 解析后端 todayWorkbench 聚合响应：{ todayCases, roomStatus, summary }。 */
export function mapWorkbenchResponse(data: unknown): {
  cases: SurgeryCase[];
  roomStatus: WorkbenchRoomStatus[];
  summary: WorkbenchSummary;
} {
  const record = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const cases = unwrapListPayload(record.todayCases ?? record.list ?? data)
    .map((row, index) => mapOperationListItem(row, index));
  const rawRooms = Array.isArray(record.roomStatus) ? record.roomStatus : [];
  const roomStatus: WorkbenchRoomStatus[] = rawRooms.map((raw) => {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const roomId = pickString(r, ['roomId', 'roomName', 'room', 'OPERATINGROOM_CODE'], '');
    return {
      roomId,
      roomName: pickString(r, ['roomName', 'room', 'roomId', 'OPERATINGROOM_CODE'], roomId),
      busy: Boolean(r.busy ?? false),
      count: pickNumber(r, ['count'], 0),
    };
  }).filter((item) => item.roomId);
  const rawSummary = (record.summary && typeof record.summary === 'object' ? record.summary : {}) as Record<string, unknown>;
  const summary: WorkbenchSummary = {
    surgeries: pickNumber(rawSummary, ['surgeries', 'total', 'count'], cases.length),
    busyRooms: pickNumber(rawSummary, ['busyRooms'], roomStatus.filter((r) => r.busy).length),
    roomCount: pickNumber(rawSummary, ['roomCount'], roomStatus.length),
    canceled: pickNumber(rawSummary, ['canceled'], 0),
    operationDate: pickString(rawSummary, ['operationDate', 'date'], ''),
  };
  return { cases, roomStatus, summary };
}

export function mergeOperationIntoCase(existing: SurgeryCase, detail: OperationDetailDto): SurgeryCase {
  const statusRaw = pickString(detail, ['status', 'operationStatus', 'OPERATION_STATUS', 'recordStatus'], existing.status);
  let status = STATUS_MAP[statusRaw] ?? existing.status;
  const room = pickString(detail, ['room', 'roomName', 'ROOMNAME', 'OPERATINGROOM_CODE'], existing.room);

  // 真实 operatenotice 时间节点（HH:MM:SS）需与 OPERATIONDATE 合并为 ISO；非时间格式则原样取用。
  const operationDate = pickString(detail, ['operationDate', 'OPERATIONDATE'], '');
  const timelineTime = (keys: string[]): string | undefined => {
    const raw = pickString(detail, keys, '');
    if (!raw) return undefined;
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(raw) && operationDate) {
      const d = new Date(`${operationDate.slice(0, 10)} ${raw}`);
      return Number.isNaN(d.getTime()) ? raw : d.toISOString();
    }
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? raw : d.toISOString();
  };

  const anesthesiaStart = timelineTime(['anesthesiaStart', 'ANESTHESIA_START_TIME']);
  const surgeryStart = timelineTime(['surgeryStart', 'OPERATION_START_TIME']);
  const surgeryEnd = timelineTime(['surgeryEnd', 'OPERATION_END_TIME', 'PLANNING_ENDTIME']);
  const leaveRoomTime = timelineTime(['leaveRoomTime', 'LEAVE_ROOM_TIME']);
  const enterRoomTime = timelineTime(['actualStart', 'roomInTime', 'ENTER_ROOM_TIME', 'FIRST_SCANNING']);
  const plannedStart = timelineTime(['plannedStart', 'PLANNING_BEGINTIME'])
    ?? pickString(detail, ['scheduledStart', 'operationDate', 'OPERATIONDATE', 'scheduleTime'], existing.plannedStart);

  // 当后端无显式状态文本时，由时间节点派生（与后端 todayWorkbench 的 busy 判定同源）。
  if (!STATUS_MAP[statusRaw]) {
    if (leaveRoomTime) status = '已离室';
    else if (surgeryEnd) status = '苏醒中';
    else if (surgeryStart) status = '手术中';
    else if (anesthesiaStart) status = '麻醉中';
    else if (enterRoomTime) status = '已入室';
    else status = existing.status;
  }

  return {
    ...existing,
    id: detail.operationId || existing.id,
    patientId: pickString(detail, ['patientId', 'patientNumber', 'PATIENT_NUMBER', 'INPATIENTNO', 'inpatientNo'], existing.patientId),
    room,
    roomId: pickString(detail, ['roomId', 'ROOMID', 'OPERATINGROOM_CODE'], existing.roomId ?? room),
    roomName: pickString(detail, ['roomName', 'ROOMNAME', 'OPERATINGROOM_CODE'], existing.roomName ?? room),
    sequence: pickNumber(detail, ['numberOfStations', 'NUMBER_OF_STATIONS', 'sequence', 'stationNo'], existing.sequence),
    patientName: pickString(detail, ['patientName', 'PATIENT_NAME', 'PATIENTNAME'], existing.patientName),
    gender: mapGender(pickField(detail, ['gender', 'sex', 'GENDER', 'PATIENT_SEX']) ?? existing.gender),
    age: pickNumber(detail, ['age', 'AGE', 'PATIENT_AGE'], existing.age),
    department: pickString(detail, ['department', 'deptName', 'DEPTNAME', 'PATIENT_DEPARTMENT_NAME', 'PATIENT_DEPARTMENT_CODE'], existing.department),
    diagnosis: pickString(detail, ['diagnosis', 'diagnosisName', 'DIAGNOSIS', 'PRE_DIAGNOSIS', 'OPERATION_NAME'], existing.diagnosis),
    surgeryName: pickString(detail, ['surgeryName', 'operationName', 'OPERATION_NAME', 'OPERATIONNAME'], existing.surgeryName),
    surgeon: pickString(detail, ['surgeon', 'surgeonName', 'SURGEON', 'DOCTOR_NAME', 'OPERATOR_NAME'], existing.surgeon),
    anesthesiaMethod: pickString(detail, ['anesthesiaMethod', 'anesMethod', 'ANESTHESIA_METHOD_NAME'], existing.anesthesiaMethod),
    asa: pickString(detail, ['asa', 'ASA'], existing.asa),
    urgency: mapUrgency(pickField(detail, ['urgency', 'operationType', 'EMERGENCY_FLAG', 'IS_EMERGENCY']) ?? existing.urgency),
    anesthesiologist: pickString(detail, ['anesthesiologist', 'anesDoctor', 'ANESTHESIOLOGIST', 'ANESTHETIST_NAME', 'ANESTHETIST_PB_NAME'], existing.anesthesiologist),
    anesthesiaNurse: pickString(detail, ['anesthesiaNurse', 'nurse', 'NURSE', 'CIRCULATINGNURSE_NAME', 'SCRUBNURSE_NAME'], existing.anesthesiaNurse),
    circulatingNurses: pickString(detail, ['circulatingNurses', 'circulatingNurse', 'CIRCULATINGNURSE_NAME'], existing.circulatingNurses),
    scrubNurses: pickString(detail, ['scrubNurses', 'scrubNurse', 'SCRUBNURSE_NAME'], existing.scrubNurses),
    status,
    plannedStart,
    scheduledStart: pickString(detail, ['scheduledStart'], plannedStart),
    actualStart: enterRoomTime ?? existing.actualStart,
    anesthesiaStart: anesthesiaStart ?? existing.anesthesiaStart,
    surgeryStart: surgeryStart ?? existing.surgeryStart,
    surgeryEnd: surgeryEnd ?? existing.surgeryEnd,
    leaveRoomTime: leaveRoomTime ?? existing.leaveRoomTime,
    emergencyInserted: mapUrgency(pickField(detail, ['urgency', 'operationType', 'EMERGENCY_FLAG', 'IS_EMERGENCY']) ?? existing.urgency) === '急诊',
    locationType: existing.locationType,
    operationCase: buildCanonicalOperationCase(detail),
    preVisit: {
      ...existing.preVisit,
      height: pickNumber(detail, ['height', 'PATIENT_HEIGHT'], existing.preVisit.height),
      weight: pickNumber(detail, ['weight', 'PATIENT_WEIGHT'], existing.preVisit.weight),
      asa: pickString(detail, ['asa', 'ASA'], existing.preVisit.asa),
      fasting: pickString(detail, ['fasting'], existing.preVisit.fasting),
      preMedication: pickString(detail, ['preMedication', 'pre_medication'], existing.preVisit.preMedication),
    },
  };
}

export function buildSnapshotFromOperation(
  caseItem: SurgeryCase,
  hospitalName?: string,
): AnesthesiaRecordSnapshot {
  return buildRecordSnapshot(caseItem, hospitalName);
}

export function buildOperationInfoQuery(params: OperationInfoQuery): string {
  const query = new URLSearchParams();
  const operationId = params.operationId ?? params.OPERATIONID;
  if (operationId) {
    query.set('operationId', operationId);
    query.set('OPERATIONID', operationId);
  }
  if (params.patientNumber) query.set('patientNumber', params.patientNumber);
  return query.toString();
}

export function buildOperationListQuery(params: OperationListQuery = {}): string {
  const query = new URLSearchParams();
  const date = params.operationDate ?? params.date;
  if (date) query.set('operationDate', date);
  const operationRoom = params.operationRoom ?? params.room ?? params.roomId;
  if (operationRoom) {
    query.set('operationRoom', operationRoom);
    if (params.room) query.set('room', params.room);
    if (params.roomId) query.set('roomId', params.roomId);
  }
  if (params.patientName) query.set('patientName', params.patientName);
  if (params.patientNumber) query.set('patientNumber', params.patientNumber);
  if (params.inpatientNo) query.set('inpatientNo', params.inpatientNo);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  return query.toString();
}

export function buildNursePbListQuery(params: NursePbListQuery): string {
  const query = new URLSearchParams();
  query.set('startTime', params.startTime);
  query.set('endTime', params.endTime);
  return query.toString();
}

export function shouldSkipRemoteOperationRefresh(caseItem: SurgeryCase | undefined): boolean {
  if (!caseItem) return true;
  if (caseItem.locked) return true;
  if (caseItem.printedAt) return true;
  return false;
}
