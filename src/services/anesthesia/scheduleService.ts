import dayjs from 'dayjs';
import { operationInfoApi } from '@/api/operationInfo';
import type { SurgeryCase } from '@/types/anesthesia';
import { pickString, unwrapListPayload } from '@/services/anesthesia/adapters/fieldUtils';
import type { RoomCatalogItem } from '@/services/anesthesia/adapters/roomAdapter';

export interface NurseScheduleRow {
  operationId: string;
  room: string;
  numberOfStations: number;
  anesthesiologist?: string;
  nurse?: string;
  circulatingNurse?: string;
  scrubNurse?: string;
}

export function mapNursePbRow(raw: unknown): NurseScheduleRow {
  const operationId = pickString(raw, ['operationId', 'OPERATIONID', 'id'], '');
  return {
    operationId,
    room: pickString(raw, ['room', 'roomName', 'ROOMNAME'], ''),
    numberOfStations: Number(pickString(raw, ['numberOfStations', 'sequence', 'stationNo'], '0')) || 0,
    anesthesiologist: pickString(raw, ['anesthesiologist', 'anesDoctor', 'ANESTHESIOLOGIST']),
    nurse: pickString(raw, ['nurse', 'anesthesiaNurse', 'NURSE']),
    circulatingNurse: pickString(raw, ['circulatingNurse', 'circulatingNurses']),
    scrubNurse: pickString(raw, ['scrubNurse', 'scrubNurses']),
  };
}

export function matchCaseRoom(caseItem: SurgeryCase, roomKey: string): boolean {
  if (!roomKey) return true;
  const keys = new Set(
    [caseItem.roomId, caseItem.room, caseItem.roomName].filter(Boolean).map(String),
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

export function buildSaveNursePbPayload(item: SurgeryCase, operationDate?: string): Record<string, unknown> {
  return {
    operationId: item.id,
    OPERATIONID: item.id,
    operationDate: operationDate ?? dayjs(item.scheduledStart ?? item.plannedStart).format('YYYY-MM-DD'),
    room: item.room,
    numberOfStations: item.sequence,
    anesthesiologist: item.anesthesiologist,
    nurse: item.anesthesiaNurse,
    circulatingNurse: item.circulatingNurses,
    scrubNurse: item.scrubNurses,
  };
}

export function nursePbDateRange(date?: string): { startTime: string; endTime: string } {
  const day = date ?? dayjs().format('YYYY-MM-DD');
  return { startTime: day, endTime: day };
}

export async function loadNurseScheduleList(date?: string): Promise<NurseScheduleRow[]> {
  const { startTime, endTime } = nursePbDateRange(date);
  try {
    const raw = await operationInfoApi.getNursePbList({ startTime, endTime });
    return unwrapListPayload(raw).map(mapNursePbRow).filter((row) => row.operationId);
  } catch {
    return [];
  }
}

export function mergeNurseScheduleIntoCases(
  cases: SurgeryCase[],
  nurseRows: NurseScheduleRow[],
): SurgeryCase[] {
  const byId = new Map(nurseRows.map((row) => [row.operationId, row]));
  return cases.map((item) => {
    const row = byId.get(item.id);
    if (!row) return item;
    return {
      ...item,
      sequence: row.numberOfStations || item.sequence,
      anesthesiologist: row.anesthesiologist || item.anesthesiologist,
      anesthesiaNurse: row.nurse || item.anesthesiaNurse,
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
