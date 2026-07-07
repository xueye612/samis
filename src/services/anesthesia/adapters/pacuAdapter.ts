import dayjs from 'dayjs';
import type { PacuPatient } from '@/types/anesthesia';
import type { PacuBooking, PacuBed, PacuRoom, PacuBedStatus } from '@/types/clinicalModules';

/** 后端 anes_pacu_record 行（camelCase，由 PacuService.formatItem 输出） */
export interface PacuRecordApi {
  id: number;
  caseId: string;
  operationId?: string;
  patientName: string;
  room?: string | null;
  bedNo?: string | null;
  pacuInTime: string;
  pacuOutTime?: string | null;
  firstTemp?: number | null;
  hr?: number | null;
  bp?: string | null;
  spo2?: number | null;
  rr?: number | null;
  aldreteIn?: number;
  aldreteOut?: number | null;
  vasScore?: number;
  nauseaVomiting?: boolean;
  shivering?: boolean;
  agitation?: boolean;
  reintubation?: boolean;
  status: string;
  outDestination?: string | null;
  handoverNurseId?: string | null;
  remark?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/** 后端行 → 前端 PacuPatient */
export function mapPacuRecordToPatient(row: PacuRecordApi): PacuPatient {
  const status = (row.status as PacuPatient['status']) ?? '观察中';
  const transferTo = (row.outDestination ?? '') as PacuPatient['transferTo'];
  return {
    id: String(row.id),
    caseId: row.caseId,
    patientName: row.patientName ?? '',
    room: row.room ?? '',
    inTime: row.pacuInTime,
    outTime: row.pacuOutTime ?? undefined,
    firstTemperature: row.firstTemp ?? undefined,
    HR: row.hr ?? 0,
    BP: row.bp ?? '',
    SpO2: row.spo2 ?? 0,
    RR: row.rr ?? 0,
    aldrete: row.aldreteIn ?? 0,
    vas: row.vasScore ?? 0,
    nausea: Boolean(row.nauseaVomiting),
    shivering: Boolean(row.shivering),
    agitation: Boolean(row.agitation),
    reintubation: Boolean(row.reintubation),
    status,
    transferTo: transferTo || ('病房' as PacuPatient['transferTo']),
    handover: row.handoverNurseId ?? '',
  };
}

/** PacuPatient + 入室现场信息 → 后端 admit payload */
export function buildPacuAdmitPayload(input: {
  caseId: string;
  patientName: string;
  room?: string;
  operationId?: string;
  pacuInTime?: string;
  firstTemperature?: number;
  hr?: number;
  bp?: string;
  spo2?: number;
  rr?: number;
  aldrete?: number;
  vas?: number;
  bedNo?: string;
  remark?: string;
}): Record<string, string | number | boolean> {
  const pacuInTime = input.pacuInTime ?? dayjs().format('YYYY-MM-DD HH:mm:ss');
  const payload: Record<string, string | number | boolean> = {
    caseId: input.caseId,
    pacuInTime,
    patientName: input.patientName,
  };
  if (input.room) payload.room = input.room;
  if (input.operationId) payload.operationId = input.operationId;
  if (input.bedNo) payload.bedNo = input.bedNo;
  if (input.firstTemperature !== undefined) payload.firstTemp = input.firstTemperature;
  if (input.hr !== undefined) payload.hr = input.hr;
  if (input.bp) payload.bp = input.bp;
  if (input.spo2 !== undefined) payload.spo2 = input.spo2;
  if (input.rr !== undefined) payload.rr = input.rr;
  if (input.aldrete !== undefined) payload.aldreteIn = input.aldrete;
  if (input.vas !== undefined) payload.vasScore = input.vas;
  if (input.remark) payload.remark = input.remark;
  return payload;
}

/** PacuPatient 编辑字段 → 后端 update payload */
export function buildPacuUpdatePayload(input: Partial<PacuPatient>): Record<string, string | number | boolean> {
  const payload: Record<string, string | number | boolean> = {};
  if (input.firstTemperature !== undefined) payload.firstTemp = input.firstTemperature;
  if (input.HR !== undefined) payload.hr = input.HR;
  if (input.BP !== undefined) payload.bp = input.BP;
  if (input.SpO2 !== undefined) payload.spo2 = input.SpO2;
  if (input.RR !== undefined) payload.rr = input.RR;
  if (input.aldrete !== undefined) payload.aldreteIn = input.aldrete;
  if (input.vas !== undefined) payload.vasScore = input.vas;
  if (input.nausea !== undefined) payload.nauseaVomiting = input.nausea;
  if (input.shivering !== undefined) payload.shivering = input.shivering;
  if (input.agitation !== undefined) payload.agitation = input.agitation;
  if (input.reintubation !== undefined) payload.reintubation = input.reintubation;
  if (input.status !== undefined) payload.status = input.status;
  return payload;
}

/** 转出信息 → 后端 transferOut payload */
export function buildPacuTransferOutPayload(input: {
  id: number | string;
  pacuOutTime?: string;
  outDestination: PacuPatient['transferTo'];
  aldreteOut?: number;
  handoverNurseId?: string;
}): Record<string, string | number | boolean> {
  const pacuOutTime = input.pacuOutTime ?? dayjs().format('YYYY-MM-DD HH:mm:ss');
  const payload: Record<string, string | number | boolean> = {
    id: input.id,
    pacuOutTime,
    outDestination: input.outDestination,
  };
  if (input.aldreteOut !== undefined) payload.aldreteOut = input.aldreteOut;
  if (input.handoverNurseId) payload.handoverNurseId = input.handoverNurseId;
  return payload;
}

/** 后端分页列表响应 → PacuPatient[] */
export function mapPacuListResponse(raw: unknown): { list: PacuPatient[]; total: number } {
  const body = (raw ?? {}) as { list?: unknown; total?: unknown };
  const rows = Array.isArray(body.list) ? (body.list as PacuRecordApi[]) : [];
  return {
    list: rows.map(mapPacuRecordToPatient),
    total: typeof body.total === 'number' ? body.total : rows.length,
  };
}

/** 后端 anes_pacu_booking 行（camelCase，由 PacuService.formatBookingItem 输出） */
export interface PacuBookingApi {
  id: number;
  caseId: string;
  patientName?: string | null;
  pacuRoomId?: string | null;
  bedId?: string | null;
  bookingTime: string;
  bookingDoctor?: string | null;
  bookingType?: string | null;
  status: string;
  remark?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/** 后端行 → 前端 PacuBooking */
export function mapPacuBookingToBooking(row: PacuBookingApi): PacuBooking {
  const bookingType = (row.bookingType === '紧急预约' ? '紧急预约' : '常规预约') as PacuBooking['bookingType'];
  const status = (['待接收', '已接收', '已取消'].includes(row.status) ? row.status : '待接收') as PacuBooking['status'];
  return {
    id: String(row.id),
    caseId: row.caseId,
    patientName: row.patientName ?? '',
    pacuRoomId: row.pacuRoomId ?? '',
    bedId: row.bedId ?? undefined,
    bookingTime: row.bookingTime,
    bookingDoctor: row.bookingDoctor ?? '',
    bookingType,
    status,
  };
}

/** PacuBooking → 后端 create payload */
export function buildPacuBookingCreatePayload(input: PacuBooking): Record<string, string | number | boolean> {
  const payload: Record<string, string | number | boolean> = {
    caseId: input.caseId,
    bookingTime: input.bookingTime,
    bookingType: input.bookingType,
  };
  if (input.patientName) payload.patientName = input.patientName;
  if (input.pacuRoomId) payload.pacuRoomId = input.pacuRoomId;
  if (input.bedId) payload.bedId = input.bedId;
  if (input.bookingDoctor) payload.bookingDoctor = input.bookingDoctor;
  return payload;
}

/** PacuBooking 编辑字段 → 后端 update payload */
export function buildPacuBookingUpdatePayload(input: Partial<PacuBooking>): Record<string, string | number | boolean> {
  const payload: Record<string, string | number | boolean> = {};
  if (input.patientName !== undefined) payload.patientName = input.patientName;
  if (input.pacuRoomId !== undefined) payload.pacuRoomId = input.pacuRoomId;
  if (input.bedId !== undefined) payload.bedId = input.bedId;
  if (input.bookingTime !== undefined) payload.bookingTime = input.bookingTime;
  if (input.bookingDoctor !== undefined) payload.bookingDoctor = input.bookingDoctor;
  if (input.bookingType !== undefined) payload.bookingType = input.bookingType;
  return payload;
}

/** 后端分页列表响应 → PacuBooking[] */
export function mapPacuBookingListResponse(raw: unknown): { list: PacuBooking[]; total: number } {
  const body = (raw ?? {}) as { list?: unknown; total?: unknown };
  const rows = Array.isArray(body.list) ? (body.list as PacuBookingApi[]) : [];
  return {
    list: rows.map(mapPacuBookingToBooking),
    total: typeof body.total === 'number' ? body.total : rows.length,
  };
}

// =====================================================================
// Slice 6c A —— 床位 adapter
// =====================================================================

/** 后端 anes_pacu_bed 行（camelCase，由 PacuService.formatBedItem 输出）。 */
export interface PacuBedApi {
  id: number;
  roomId: string;
  bedNo: string;
  status: string;
  patientName?: string | null;
  caseId?: string | null;
  inTime?: string | null;
  outTime?: string | null;
  remark?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

const VALID_BED_STATUS: PacuBedStatus[] = ['空闲', '占用', '预留', '维护'];

/** 后端床位行 → 前端 PacuBed。 */
export function mapPacuBedToBed(row: PacuBedApi): PacuBed {
  const status = (VALID_BED_STATUS as string[]).includes(row.status) ? (row.status as PacuBedStatus) : '空闲';
  return {
    id: String(row.id),
    roomId: row.roomId,
    bedNo: row.bedNo,
    status,
    patientName: row.patientName ?? undefined,
    caseId: row.caseId ?? undefined,
    inTime: row.inTime ?? undefined,
  };
}

/** 后端 bedAllGrouped 响应 → PacuRoom[]（保留 beds:PacuBed[] 形状，兼容现有 getter）。 */
export function mapBedGroupedToRooms(raw: unknown): PacuRoom[] {
  const arr = Array.isArray(raw) ? (raw as Array<{ roomId?: string; roomName?: string | null; beds?: PacuBedApi[] }>) : [];
  return arr.map((group, idx) => {
    const roomId = group.roomId ?? `room-${idx}`;
    const beds = Array.isArray(group.beds) ? group.beds.map(mapPacuBedToBed) : [];
    return {
      id: roomId,
      name: group.roomName ?? roomId,
      code: roomId,
      bedCount: beds.length,
      beds,
    };
  });
}

/** 后端 bedStats 响应（total/used/free/reserved/maintenance）。 */
export interface PacuBedStatsApi {
  total: number;
  used: number;
  free: number;
  reserved: number;
  maintenance: number;
}

export function mapBedStats(raw: unknown): PacuBedStatsApi {
  const body = (raw ?? {}) as Partial<PacuBedStatsApi>;
  return {
    total: Number(body.total ?? 0),
    used: Number(body.used ?? 0),
    free: Number(body.free ?? 0),
    reserved: Number(body.reserved ?? 0),
    maintenance: Number(body.maintenance ?? 0),
  };
}
