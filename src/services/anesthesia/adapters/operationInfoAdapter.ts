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

export function mapOperationDetail(raw: unknown): OperationDetailDto {
  const operationId = pickString(raw, ['operationId', 'OPERATIONID', 'id'], '');
  return {
    ...(typeof raw === 'object' && raw ? raw as Record<string, unknown> : {}),
    operationId,
  };
}

export function mapOperationListItem(raw: unknown, index = 0): SurgeryCase {
  const detail = mapOperationDetail(raw);
  const id = detail.operationId || `operation-${index}`;
  const base = emptyClinicalShell(id);
  return mergeOperationIntoCase(base, detail);
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
  const enterRoomTime = timelineTime(['actualStart', 'roomInTime', 'ENTER_ROOM_TIME']);
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
