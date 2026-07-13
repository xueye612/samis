import { Message } from '@arco-design/web-vue';
import { pacuApi } from '@/api/pacu';
import { notifyIfUnhandledSamisError } from '@/services/auth/authErrorPresentation';
import { useRealPacu } from '@/config/apiFlags';
import { SamisHttpError } from '@/api/samisHttpClient';
import { isSamisLoggedIn } from '@/services/session/samisSession';
import type { PacuPatient } from '@/types/anesthesia';
import type { PacuBooking, PacuRoom } from '@/types/clinicalModules';
import {
  buildPacuAdmitPayload,
  buildPacuTransferOutPayload,
  buildPacuUpdatePayload,
  buildPacuBookingCreatePayload,
  buildPacuBookingUpdatePayload,
  mapPacuListResponse,
  mapPacuBookingListResponse,
  mapPacuBookingToBooking,
  mapBedGroupedToRooms,
  mapBedStats,
  type PacuRecordApi,
  type PacuBookingApi,
  type PacuBedStatsApi,
} from '@/services/anesthesia/adapters/pacuAdapter';

export type { PacuBedStatsApi };

export interface PacuListState {
  list: PacuPatient[];
  total: number;
  source: 'remote' | 'mock';
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof SamisHttpError) return error.message;
  return error instanceof Error ? error.message : fallback;
}

/** 加载 PACU 恢复单列表（真实开关开→调 api；失败回落 mock）。 */
export async function loadRemotePacuList(params?: {
  status?: string;
  room?: string;
  caseId?: string;
}): Promise<PacuListState> {
  const query = {
    status: params?.status,
    room: params?.room,
    caseId: params?.caseId,
    page: 1,
    pageSize: 100,
  };

  if (!useRealPacu()) {
    const raw = await pacuApi.getList(query);
    const { list, total } = mapPacuListResponse(raw);
    return { list, total, source: 'mock' };
  }

  if (!isSamisLoggedIn()) {
    return { list: [], total: 0, source: 'mock' };
  }

  try {
    const raw = await pacuApi.getList(query);
    const { list, total } = mapPacuListResponse(raw);
    return { list, total, source: 'remote' };
  } catch (error) {
    notifyIfUnhandledSamisError(error, () => Message.warning(`${describeError(error, '加载 PACU 恢复单失败')}，已使用本地数据`));
    return { list: [], total: 0, source: 'mock' };
  }
}

/** 入 PACU（真实开关开→调 api 返回新行；关→返回 undefined 由 store 本地构建）。 */
export async function admitPacuPatient(input: {
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
}): Promise<PacuPatient | null> {
  const payload = buildPacuAdmitPayload(input);

  if (!useRealPacu()) {
    await pacuApi.admit(payload); // mock 路由兜底
    return null;
  }

  if (!isSamisLoggedIn()) {
    throw new Error('未登录，无法入 PACU');
  }

  const result = await pacuApi.admit(payload);
  const created = result as PacuRecordApi;
  if (created && created.id) {
    const { mapPacuRecordToPatient } = await import('@/services/anesthesia/adapters/pacuAdapter');
    return mapPacuRecordToPatient(created);
  }
  return null;
}

/** 更新恢复记录字段（真实开关开→调 api）。 */
export async function updatePacuRecordRemote(
  id: string | number,
  patch: Partial<PacuPatient>,
): Promise<void> {
  if (!useRealPacu() || !isSamisLoggedIn()) {
    if (!useRealPacu()) {
      await pacuApi.update({ id, ...buildPacuUpdatePayload(patch) }); // mock 兜底
    }
    return;
  }
  await pacuApi.update({ id, ...buildPacuUpdatePayload(patch) });
}

/** 转出（真实开关开→调 api）。 */
export async function transferOutPacuPatient(input: {
  id: string | number;
  pacuOutTime?: string;
  outDestination: PacuPatient['transferTo'];
  aldreteOut?: number;
  handoverNurseId?: string;
}): Promise<void> {
  const payload = buildPacuTransferOutPayload(input);
  if (!useRealPacu()) {
    await pacuApi.transferOut(payload); // mock 兜底
    return;
  }
  if (!isSamisLoggedIn()) {
    throw new Error('未登录，无法转出 PACU 患者');
  }
  await pacuApi.transferOut(payload);
}

export interface PacuBookingListState {
  list: PacuBooking[];
  total: number;
  source: 'remote' | 'mock';
}

/** 加载 PACU 预约列表（真实开关开→调 api；失败回落 mock）。 */
export async function loadRemotePacuBookings(params?: {
  status?: string;
  pacuRoomId?: string;
  caseId?: string;
}): Promise<PacuBookingListState> {
  const query = {
    status: params?.status,
    pacuRoomId: params?.pacuRoomId,
    caseId: params?.caseId,
    page: 1,
    pageSize: 100,
  };

  if (!useRealPacu()) {
    const raw = await pacuApi.bookingList(query);
    const { list, total } = mapPacuBookingListResponse(raw);
    return { list, total, source: 'mock' };
  }

  if (!isSamisLoggedIn()) {
    return { list: [], total: 0, source: 'mock' };
  }

  try {
    const raw = await pacuApi.bookingList(query);
    const { list, total } = mapPacuBookingListResponse(raw);
    return { list, total, source: 'remote' };
  } catch (error) {
    notifyIfUnhandledSamisError(error, () => Message.warning(`${describeError(error, '加载 PACU 预约失败')}，已使用本地数据`));
    return { list: [], total: 0, source: 'mock' };
  }
}

/** 创建预约（真实开关开→调 api 返回新行；关→返回 null 由 store 本地构建）。 */
export async function createPacuBookingRemote(
  input: PacuBooking,
): Promise<PacuBooking | null> {
  const payload = buildPacuBookingCreatePayload(input);

  if (!useRealPacu()) {
    await pacuApi.bookingCreate(payload); // mock 路由兜底
    return null;
  }

  if (!isSamisLoggedIn()) {
    throw new Error('未登录，无法创建 PACU 预约');
  }

  const result = await pacuApi.bookingCreate(payload);
  const created = result as PacuBookingApi;
  if (created && created.id) {
    return mapPacuBookingToBooking(created);
  }
  return null;
}

/** 更新预约（真实开关开→调 api）。 */
export async function updatePacuBookingRemote(
  id: string | number,
  patch: Partial<PacuBooking>,
): Promise<void> {
  const payload = { id, ...buildPacuBookingUpdatePayload(patch) };
  if (!useRealPacu()) {
    await pacuApi.bookingUpdate(payload); // mock 兜底
    return;
  }
  if (!isSamisLoggedIn()) {
    throw new Error('未登录，无法更新 PACU 预约');
  }
  await pacuApi.bookingUpdate(payload);
}

/** 取消预约（真实开关开→调 api）。 */
export async function cancelPacuBookingRemote(id: string | number): Promise<void> {
  if (!useRealPacu()) {
    await pacuApi.bookingCancel(id); // mock 兜底
    return;
  }
  if (!isSamisLoggedIn()) {
    throw new Error('未登录，无法取消 PACU 预约');
  }
  await pacuApi.bookingCancel(id);
}

// =====================================================================
// Slice 6c A —— 床位
// =====================================================================

export interface PacuBedState {
  rooms: PacuRoom[];
  stats: PacuBedStatsApi | null;
  source: 'remote' | 'mock';
}

/** 加载床位（按 room 分组）+ 床位统计（真实开关开→远程；失败回落 mock 派生）。 */
export async function loadRemotePacuBeds(): Promise<PacuBedState> {
  if (!useRealPacu() || !isSamisLoggedIn()) {
    const raw = await pacuApi.bedAllGrouped();
    const rooms = mapBedGroupedToRooms(raw);
    const stats = deriveStatsFromRooms(rooms);
    return { rooms, stats, source: 'mock' };
  }
  try {
    const [groupedRaw, statsRaw] = await Promise.all([pacuApi.bedAllGrouped(), pacuApi.bedStats()]);
    const rooms = mapBedGroupedToRooms(groupedRaw);
    const stats = mapBedStats(statsRaw);
    return { rooms, stats, source: 'remote' };
  } catch (error) {
    notifyIfUnhandledSamisError(error, () => Message.warning(`${describeError(error, '加载 PACU 床位失败')}，已使用本地数据`));
    return { rooms: [], stats: null, source: 'mock' };
  }
}

function deriveStatsFromRooms(rooms: PacuRoom[]): PacuBedStatsApi {
  const beds = rooms.flatMap((r) => r.beds);
  return {
    total: beds.length,
    used: beds.filter((b) => b.status === '占用').length,
    free: beds.filter((b) => b.status === '空闲').length,
    reserved: beds.filter((b) => b.status === '预留').length,
    maintenance: beds.filter((b) => b.status === '维护').length,
  };
}
