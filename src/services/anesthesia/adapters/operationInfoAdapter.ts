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

function emptyClinicalShell(id: string): SurgeryCase {
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

export function mergeOperationIntoCase(existing: SurgeryCase, detail: OperationDetailDto): SurgeryCase {
  const statusRaw = pickString(detail, ['status', 'operationStatus', 'recordStatus'], existing.status);
  const status = STATUS_MAP[statusRaw] ?? existing.status;
  const room = pickString(detail, ['room', 'roomName', 'ROOMNAME'], existing.room);
  return {
    ...existing,
    id: detail.operationId || existing.id,
    patientId: pickString(detail, ['patientId', 'patientNumber', 'INPATIENTNO', 'inpatientNo'], existing.patientId),
    room,
    roomId: pickString(detail, ['roomId', 'ROOMID'], existing.roomId ?? room),
    roomName: pickString(detail, ['roomName', 'ROOMNAME'], existing.roomName ?? room),
    sequence: pickNumber(detail, ['numberOfStations', 'sequence', 'stationNo'], existing.sequence),
    patientName: pickString(detail, ['patientName', 'PATIENTNAME'], existing.patientName),
    gender: mapGender(pickField(detail, ['gender', 'sex', 'GENDER']) ?? existing.gender),
    age: pickNumber(detail, ['age', 'AGE'], existing.age),
    department: pickString(detail, ['department', 'deptName', 'DEPTNAME'], existing.department),
    diagnosis: pickString(detail, ['diagnosis', 'diagnosisName', 'DIAGNOSIS'], existing.diagnosis),
    surgeryName: pickString(detail, ['surgeryName', 'operationName', 'OPERATIONNAME'], existing.surgeryName),
    surgeon: pickString(detail, ['surgeon', 'surgeonName', 'SURGEON'], existing.surgeon),
    anesthesiaMethod: pickString(detail, ['anesthesiaMethod', 'anesMethod'], existing.anesthesiaMethod),
    asa: pickString(detail, ['asa', 'ASA'], existing.asa),
    urgency: mapUrgency(pickField(detail, ['urgency', 'operationType']) ?? existing.urgency),
    anesthesiologist: pickString(detail, ['anesthesiologist', 'anesDoctor', 'ANESTHESIOLOGIST'], existing.anesthesiologist),
    anesthesiaNurse: pickString(detail, ['anesthesiaNurse', 'nurse', 'NURSE'], existing.anesthesiaNurse),
    circulatingNurses: pickString(detail, ['circulatingNurses', 'circulatingNurse'], existing.circulatingNurses),
    scrubNurses: pickString(detail, ['scrubNurses', 'scrubNurse'], existing.scrubNurses),
    status,
    plannedStart: pickString(detail, ['plannedStart', 'operationDate', 'scheduleTime'], existing.plannedStart),
    scheduledStart: pickString(detail, ['scheduledStart', 'plannedStart'], existing.scheduledStart),
    locationType: existing.locationType,
    preVisit: {
      ...existing.preVisit,
      height: pickNumber(detail, ['height'], existing.preVisit.height),
      weight: pickNumber(detail, ['weight'], existing.preVisit.weight),
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
