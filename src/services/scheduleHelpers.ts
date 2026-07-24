import dayjs from 'dayjs';
import type { SurgeryCase } from '@/types/anesthesia';

const ACTIVE_STATUSES = ['已入室', '麻醉诱导', '麻醉中', '手术中', '苏醒中'] as const;

function toValidIso(raw: unknown, fallback?: dayjs.Dayjs): string {
  const parsed = dayjs(raw as string | number | Date | undefined);
  if (parsed.isValid()) return parsed.toISOString();
  return (fallback ?? dayjs()).toISOString();
}

export interface NormalizedCaseSchedule {
  caseId: string;
  patientId: string;
  roomId: string;
  roomName: string;
  startTime: string;
  endTime: string;
  actualStart?: string;
  isEmergency: boolean;
  isActive: boolean;
  source: string;
}

export interface RoomScheduleGroup {
  roomId: string;
  roomName: string;
  cases: SurgeryCase[];
}

export interface RoomAssignmentSummary {
  total: number;
  assigned: number;
  unassigned: number;
}

const UNASSIGNED_ROOM_ID = '__UNASSIGNED__';

function roomIdentity(item: SurgeryCase): { id: string; name: string } {
  const canonical = item.operationCase;
  const id = String(canonical?.roomCode ?? item.roomId ?? item.room ?? '').trim();
  const name = String(canonical?.roomName ?? item.roomName ?? item.room ?? id).trim();
  return { id, name: name || id };
}

export function normalizeCaseSchedule(item: SurgeryCase): NormalizedCaseSchedule {
  const startTime = toValidIso(
    item.scheduledStart ?? item.plannedStart ?? item.surgeryStart ?? item.anesthesiaStart,
  );
  const endTime = [item.scheduledEnd, item.surgeryEnd, item.leaveRoomTime]
    .map((value) => dayjs(value as string | undefined))
    .find((value) => value.isValid())
    ?.toISOString()
    ?? dayjs(startTime).add(item.expectedDurationMinutes || 60, 'minute').toISOString();

  return {
    caseId: item.id,
    patientId: item.patientId ?? item.id,
    roomId: item.roomId ?? item.room,
    roomName: item.roomName ?? item.room,
    startTime,
    endTime,
    actualStart: item.actualStart ?? item.anesthesiaStart,
    isEmergency: item.urgency === '急诊' || Boolean(item.emergencyInserted),
    isActive: ACTIVE_STATUSES.includes(item.status as (typeof ACTIVE_STATUSES)[number]),
    source: item.nursingScheduleSource ?? '手术护理系统正式排班',
  };
}

export function getAssignedAnesthesiologists(item: SurgeryCase): string[] {
  const values = [item.anesthesiologist, ...(item.assignedAnesthesiologistIds ?? [])].filter(Boolean);
  return Array.from(new Set(values));
}

export function isCaseAssignedToDoctor(item: SurgeryCase, doctorName: string): boolean {
  return getAssignedAnesthesiologists(item).includes(doctorName);
}

export function sortCasesByClinicalPriority(cases: SurgeryCase[]): SurgeryCase[] {
  return [...cases].sort((a, b) => {
    const aMeta = normalizeCaseSchedule(a);
    const bMeta = normalizeCaseSchedule(b);
    if (aMeta.isActive !== bMeta.isActive) return aMeta.isActive ? -1 : 1;
    if (aMeta.isEmergency !== bMeta.isEmergency) return aMeta.isEmergency ? -1 : 1;
    return dayjs(aMeta.startTime).valueOf() - dayjs(bMeta.startTime).valueOf();
  });
}

/**
 * 按 operationId（item.id）去重病例列表。
 * 多来源（远端列表 + 本地 IndexedDB 孤儿）合并、轮询追加时，相同 operationId 只保留一项；
 * 保留信息更完整、更新时间更新的记录。operationId 为空的记录被过滤。
 *
 * 同一患者若有不同 operationId 的多台手术，不会被按姓名去重，各自保留。
 */
export function dedupeCasesByOperationId(cases: SurgeryCase[]): SurgeryCase[] {
  const map = new Map<string, SurgeryCase>();
  const completeness = (c: SurgeryCase): number =>
    (c.vitals?.length ? 1 : 0) + (c.medications?.length ? 1 : 0) + (c.recordStatus ? 1 : 0) + (c.surgeryName ? 1 : 0);
  const freshness = (c: SurgeryCase): number => dayjs(c.actualStart ?? c.scheduledStart ?? 0).valueOf();
  for (const item of cases) {
    const key = String(item.id ?? '').trim();
    if (!key) continue; // operationId 缺失：不生成选项
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
      continue;
    }
    if (completeness(item) > completeness(existing) || freshness(item) > freshness(existing)) {
      map.set(key, item);
    }
  }
  return Array.from(map.values());
}

export function groupCasesByRoom(cases: SurgeryCase[], rooms: string[]): RoomScheduleGroup[] {
  const groups = new Map<string, RoomScheduleGroup>();
  rooms.map((room) => String(room ?? '').trim()).filter(Boolean).forEach((room) => {
    if (!groups.has(room)) groups.set(room, { roomId: room, roomName: room, cases: [] });
  });

  const unassigned: SurgeryCase[] = [];
  cases.forEach((item) => {
    const room = roomIdentity(item);
    if (!room.id) {
      unassigned.push(item);
      return;
    }
    const group = groups.get(room.id) ?? { roomId: room.id, roomName: room.name, cases: [] };
    if (room.name && (group.roomName === group.roomId || !group.roomName)) group.roomName = room.name;
    group.cases.push(item);
    groups.set(room.id, group);
  });

  const result = Array.from(groups.values()).map((group) => ({
    ...group,
    cases: sortCasesByClinicalPriority(group.cases),
  }));
  if (unassigned.length) {
    result.push({
      roomId: UNASSIGNED_ROOM_ID,
      roomName: '待分配',
      cases: sortCasesByClinicalPriority(unassigned),
    });
  }
  return result;
}

export function summarizeRoomAssignments(cases: SurgeryCase[]): RoomAssignmentSummary {
  const assigned = cases.filter((item) => Boolean(roomIdentity(item).id)).length;
  return { total: cases.length, assigned, unassigned: cases.length - assigned };
}

export function getDoctorCases(cases: SurgeryCase[], doctorName: string): SurgeryCase[] {
  return sortCasesByClinicalPriority(cases.filter((item) => isCaseAssignedToDoctor(item, doctorName)));
}
