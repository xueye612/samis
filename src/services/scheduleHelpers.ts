import dayjs from 'dayjs';
import type { SurgeryCase } from '@/types/anesthesia';

const ACTIVE_STATUSES = ['已入室', '麻醉诱导', '麻醉中', '手术中', '苏醒中'] as const;

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

export function normalizeCaseSchedule(item: SurgeryCase): NormalizedCaseSchedule {
  const startTime = item.scheduledStart ?? item.plannedStart;
  const endTime =
    item.scheduledEnd ??
    item.surgeryEnd ??
    item.leaveRoomTime ??
    dayjs(startTime).add(item.expectedDurationMinutes || 60, 'minute').toISOString();

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

export function groupCasesByRoom(cases: SurgeryCase[], rooms: string[]): RoomScheduleGroup[] {
  const knownRooms = rooms.filter((room) => room.startsWith('OR-') || ['产房', '内镜中心'].includes(room));
  return knownRooms.map((room) => ({
    roomId: room,
    roomName: room,
    cases: sortCasesByClinicalPriority(cases.filter((item) => (item.roomId ?? item.room) === room)),
  }));
}

export function getDoctorCases(cases: SurgeryCase[], doctorName: string): SurgeryCase[] {
  return sortCasesByClinicalPriority(cases.filter((item) => isCaseAssignedToDoctor(item, doctorName)));
}
