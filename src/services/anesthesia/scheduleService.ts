import dayjs from 'dayjs';
import { operationInfoApi } from '@/api/operationInfo';
import type { SurgeryCase } from '@/types/anesthesia';
import { pickString, unwrapListPayload } from '@/services/anesthesia/adapters/fieldUtils';
import type { RoomCatalogItem } from '@/services/anesthesia/adapters/roomAdapter';

export interface NurseScheduleRow {
  operationId: string;
  startDate?: string;
  endDate?: string;
  roomCode: string;
  roomName: string;
  room: string;
  numberOfStations: number;
  anesthesiologist?: string;
  nurse?: string;
  circulatingNurse?: string;
  scrubNurse?: string;
}

export function mapNursePbRow(raw: unknown): NurseScheduleRow {
  const operationId = pickString(raw, ['operationId', 'OPERATIONID', 'id'], '');
  const roomCode = pickString(raw, ['roomCode', 'OPERATINGROOM_CODE', 'room', 'roomId'], '');
  const roomName = pickString(raw, ['roomName', 'OPERATINGROOM_NAME', 'ROOMNAME'], roomCode);
  return {
    operationId,
    startDate: pickString(raw, ['startDate', 'start_date', 'time']),
    endDate: pickString(raw, ['endDate', 'end_date']),
    roomCode,
    roomName,
    room: roomCode || roomName,
    numberOfStations: Number(pickString(raw, ['numberOfStations', 'sequence', 'stationNo'], '0')) || 0,
    anesthesiologist: pickString(raw, ['anesthesiologist', 'anesDoctor', 'ANESTHESIOLOGIST', 'ANESTHETIST_PB_NAME']),
    nurse: pickString(raw, ['nurse', 'anesthesiaNurse', 'NURSE']),
    circulatingNurse: pickString(raw, ['circulatingNurse', 'circulatingNurses', 'CIRCULATINGNURSE_NAME']),
    scrubNurse: pickString(raw, ['scrubNurse', 'scrubNurses', 'SCRUBNURSE_NAME']),
  };
}

export function matchCaseRoom(caseItem: SurgeryCase, roomKey: string): boolean {
  if (!roomKey) return true;
  const keys = new Set(
    [
      caseItem.operationCase?.roomCode,
      caseItem.operationCase?.roomName,
      caseItem.roomId,
      caseItem.room,
      caseItem.roomName,
    ].filter(Boolean).map(String),
  );
  return keys.has(roomKey);
}

export function matchCaseToRoomCatalog(caseItem: SurgeryCase, catalog?: RoomCatalogItem): boolean {
  if (!catalog) return true;
  return (
    caseItem.roomId === catalog.roomId
    || caseItem.room === catalog.roomId
    || caseItem.room === catalog.roomName
    || caseItem.roomName === catalog.roomName
  );
}

export function surgeryCaseToOperationUpdatePayload(item: SurgeryCase): Record<string, unknown> {
  const roomCode = item.roomId ?? item.room;
  return {
    operationId: item.id,
    OPERATIONID: item.id,
    OPERATINGROOM_CODE: roomCode,
    NUMBER_OF_STATIONS: item.sequence,
    PATIENT_HEIGHT: item.preVisit.height,
    PATIENT_WEIGHT: item.preVisit.weight,
    patientName: item.patientName,
    room: item.room,
    roomId: roomCode,
    numberOfStations: item.sequence,
    surgeryName: item.surgeryName,
    diagnosis: item.diagnosis,
    surgeon: item.surgeon,
    anesthesiologist: item.anesthesiologist,
    anesthesiaMethod: item.anesthesiaMethod,
    plannedStart: item.plannedStart,
    scheduledStart: item.scheduledStart,
    status: item.status,
  };
}

export interface MasterDataChange {
  /** 规范字段名（受控白名单内）。 */
  field: string;
  value: unknown;
}

export interface MasterDataUpdateEnvelope {
  operationId: string;
  expectedVersion: number | null;
  reason: string;
  changes: MasterDataChange[];
  /** 旧后端兼容平铺字段（保留，逐步迁移后移除）。 */
  [legacy: string]: unknown;
}

/** SurgeryCase 展示字段 → 受控规范字段（用于编辑差异计算）。 */
const DISPLAY_TO_CONTROLLED: Array<{ canonical: string; get: (c: SurgeryCase) => unknown }> = [
  { canonical: 'patientName', get: (c) => c.patientName },
  { canonical: 'gender', get: (c) => c.gender },
  { canonical: 'age', get: (c) => c.age },
  { canonical: 'plannedStartTime', get: (c) => c.scheduledStart ?? c.plannedStart },
  { canonical: 'plannedEndTime', get: (c) => c.scheduledEnd },
  { canonical: 'operatorName', get: (c) => c.surgeon },
  { canonical: 'anesthesiaMethodName', get: (c) => c.anesthesiaMethod },
  { canonical: 'anesthesiologistName', get: (c) => c.anesthesiologist },
  { canonical: 'preoperativeDiagnosisName', get: (c) => c.diagnosis },
  { canonical: 'plannedOperationName', get: (c) => c.surgeryName },
  { canonical: 'departmentName', get: (c) => c.department },
  { canonical: 'roomCode', get: (c) => c.roomId ?? c.room },
  { canonical: 'roomName', get: (c) => c.roomName ?? c.room },
  { canonical: 'sequence', get: (c) => c.sequence },
];

/** 比较编辑前后 SurgeryCase 展示字段，生成受控 changes（仅实际变化字段）。 */
export function buildMasterDataChangesFromDiff(original: SurgeryCase, current: SurgeryCase): MasterDataChange[] {
  const changes: MasterDataChange[] = [];
  for (const { canonical, get } of DISPLAY_TO_CONTROLLED) {
    const before = get(original);
    const after = get(current);
    const norm = (v: unknown) => (v === undefined || v === null || v === '') ? '' : String(v);
    if (norm(before) !== norm(after)) {
      changes.push({ field: canonical, value: after });
    }
  }
  return changes;
}

/**
 * 构建受控主数据修改信封 { operationId, expectedVersion, reason, changes }；
 * changes 只使用规范字段名，同时保留旧后端需要的平铺兼容字段。
 */
export function buildMasterDataUpdateEnvelope(
  item: SurgeryCase,
  reason: string,
  changes: MasterDataChange[],
): MasterDataUpdateEnvelope {
  const legacy = surgeryCaseToOperationUpdatePayload(item);
  return {
    ...legacy,
    operationId: item.id,
    expectedVersion: item.operationCase?.version ?? null,
    reason: reason.trim(),
    changes: changes.map((change) => ({ field: change.field, value: change.value })),
  };
}

export function buildSaveNursePbPayload(item: SurgeryCase, operationDate?: string): Record<string, unknown> {
  const day = operationDate
    ?? item.operationCase?.operationDate
    ?? dayjs(item.scheduledStart ?? item.plannedStart).format('YYYY-MM-DD');
  const roomCode = String(item.operationCase?.roomCode ?? item.roomId ?? item.room ?? '').trim();
  const roomName = String(item.operationCase?.roomName ?? item.roomName ?? item.room ?? roomCode).trim();
  return {
    time: day,
    start_date: day,
    end_date: day,
    OPERATINGROOM_CODE: roomCode,
    OPERATINGROOM_NAME: roomName,
    ANESTHETIST_PB_CODE: '',
    ANESTHETIST_PB_NAME: item.anesthesiologist || '',
    CIRCULATINGNURSE_CODE: '',
    CIRCULATINGNURSE_NAME: item.circulatingNurses || '',
    SCRUBNURSE_CODE: '',
    SCRUBNURSE_NAME: item.scrubNurses || '',
  };
}

export function nursePbDateRange(date?: string): { startTime: string; endTime: string } {
  const day = date ?? dayjs().format('YYYY-MM-DD');
  return { startTime: day, endTime: day };
}

function parseScheduleDateTime(value: unknown, operationDate?: string): dayjs.Dayjs | null {
  const text = String(value ?? '').trim();
  if (!text || /^0{4}-0{2}-0{2}/.test(text)) return null;
  if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(text)) {
    const base = String(operationDate ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) return null;
    const combined = dayjs(`${base} ${text}`);
    return combined.isValid() ? combined : null;
  }
  const parsed = dayjs(text);
  return parsed.isValid() && parsed.year() >= 1900 ? parsed : null;
}

/**
 * 排班时间统一展示：拒绝 0000-00-00、空串和不可解析值；结束时间缺失时按预计时长推导。
 * 兼容护理/HULI 只返回 HH:mm 的历史数据，但必须由 OperationCase 手术日期补全。
 */
export function formatScheduleRange(item: SurgeryCase): string {
  const operationDate = item.operationCase?.operationDate
    ?? [item.scheduledStart, item.plannedStart]
      .map((value) => parseScheduleDateTime(value))
      .find(Boolean)?.format('YYYY-MM-DD');
  const start = parseScheduleDateTime(item.scheduledStart ?? item.plannedStart, operationDate);
  const explicitEnd = parseScheduleDateTime(item.scheduledEnd ?? item.surgeryEnd, operationDate);
  const end = explicitEnd ?? (start ? start.add(item.expectedDurationMinutes || 60, 'minute') : null);
  return `${start?.format('HH:mm') ?? '待定'} - ${end?.format('HH:mm') ?? '待定'}`;
}

export async function loadNurseScheduleList(date?: string): Promise<NurseScheduleRow[]> {
  const { startTime, endTime } = nursePbDateRange(date);
  try {
    const raw = await operationInfoApi.getNursePbList({ startTime, endTime });
    return unwrapListPayload(raw).map(mapNursePbRow).filter((row) => row.operationId || row.roomCode || row.roomName);
  } catch {
    return [];
  }
}

export function mergeNurseScheduleIntoCases(
  cases: SurgeryCase[],
  nurseRows: NurseScheduleRow[],
): SurgeryCase[] {
  const byId = new Map(nurseRows.filter((row) => row.operationId).map((row) => [row.operationId, row]));
  const rowDate = (row: NurseScheduleRow) => String(row.startDate ?? row.endDate ?? '').slice(0, 10);
  const caseDate = (item: SurgeryCase) => {
    const canonical = String(item.operationCase?.operationDate ?? '').slice(0, 10);
    if (canonical) return canonical;
    const parsed = dayjs(item.scheduledStart ?? item.plannedStart);
    return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
  };
  const caseRoomKeys = (item: SurgeryCase) => new Set([
    item.operationCase?.roomCode,
    item.operationCase?.roomName,
    item.roomId,
    item.room,
    item.roomName,
  ].map((value) => String(value ?? '').trim()).filter(Boolean));
  return cases.map((item) => {
    const direct = byId.get(item.id);
    const keys = caseRoomKeys(item);
    const date = caseDate(item);
    const row = direct ?? nurseRows.find((candidate) => {
      const candidateRoom = String(candidate.roomCode || candidate.roomName || candidate.room).trim();
      const candidateDate = rowDate(candidate);
      return Boolean(candidateRoom) && keys.has(candidateRoom) && (!candidateDate || !date || candidateDate === date);
    });
    if (!row) return item;
    return {
      ...item,
      anesthesiologist: row.anesthesiologist || item.anesthesiologist,
      circulatingNurses: row.circulatingNurse || item.circulatingNurses,
      scrubNurses: row.scrubNurse || item.scrubNurses,
    };
  });
}

export async function saveNurseSchedule(data: unknown) {
  return operationInfoApi.saveNursePb(data);
}

export async function updateOperationStations(
  items: Array<{ operationId: string; numberOfStations: number; room?: string }>,
) {
  return operationInfoApi.updateNumberOfStations({ items });
}

export async function persistOperationInfoFields(item: SurgeryCase) {
  await operationInfoApi.updateOperationInfo(surgeryCaseToOperationUpdatePayload(item));
}
