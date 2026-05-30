import dayjs from 'dayjs';
import type { TemplateLandingItem } from '@/mock/anesthesiaRecordPrototype';
import type { AnesthesiaEvent, MedicationRecord, SurgeryCase } from '@/types/anesthesia';
import { getQuickEventOption } from '@/services/anesthesiaRecordMethodEngine';

const professionalFieldKey = (group: string, label: string) => `${group}::${label}`;

export function buildLandingEvent(item: TemplateLandingItem, target: SurgeryCase): AnesthesiaEvent {
  const event = item.event!;
  const option = getQuickEventOption(event.name);
  return {
    id: `landing-${item.landingId}`,
    type: event.name,
    time: dayjs(`${dayjs(target.plannedStart).format('YYYY-MM-DD')} ${event.time}`).toISOString(),
    stage: event.stage,
    severity: event.severity,
    treatment: event.note || `模板落单：${event.name}`,
    staff: [target.anesthesiologist, target.anesthesiaNurse].filter(Boolean),
    reported: false,
    qualityIncluded: ['低血压', '低氧', '低体温', '困难气道', '抢救'].includes(event.name),
  };
}

export function buildLandingMedication(item: TemplateLandingItem, target: SurgeryCase): Omit<MedicationRecord, 'id'> {
  const med = item.medication!;
  const baseDate = dayjs(target.plannedStart).format('YYYY-MM-DD');
  const startTime = dayjs(`${baseDate} ${med.time}`).toISOString();
  const endTime = med.endTime ? dayjs(`${baseDate} ${med.endTime}`).toISOString() : undefined;
  return {
    mode: med.mode ?? '单次用药',
    time: startTime,
    startTime,
    endTime,
    stopTime: endTime,
    drug: med.drug,
    dose: med.dose,
    unit: med.unit,
    route: med.route,
    pumpRate: med.pumpRate,
    executor: target.anesthesiologist,
  };
}

export function applyLandingSyncFields(target: SurgeryCase, event: AnesthesiaEvent) {
  const option = getQuickEventOption(event.type);
  if (option.syncField === 'anesthesiaStart') target.anesthesiaStart = event.time;
  if (option.syncField === 'surgeryStart') target.surgeryStart = event.time;
  if (option.syncField === 'surgeryEnd') target.surgeryEnd = event.time;
  if (option.syncField === 'anesthesiaEnd') target.anesthesiaEnd = event.time;
  if (option.syncField === 'leaveRoomTime') target.leaveRoomTime = event.time;
  if (option.syncField === 'roomInTime') target.roomInTime = event.time;
  if (event.type.includes('插管') || event.type.includes('喉罩')) {
    target.airwayRecord = {
      ...(target.airwayRecord ?? {}),
      intubationTime: event.time,
      intubationMethod: event.type.includes('喉罩') ? '喉罩' : '气管插管',
    };
  }
  if (event.type.includes('拔管') || event.type.includes('拔除喉罩')) {
    target.airwayRecord = {
      ...(target.airwayRecord ?? {}),
      extubationTime: event.time,
    };
  }
  if (event.type.includes('入室')) target.roomInTime = event.time;
  if (event.type.includes('麻醉结束')) target.anesthesiaEnd = event.time;
}

export function applyProfessionalFieldLanding(target: SurgeryCase, item: TemplateLandingItem) {
  if (!item.field) return;
  target.professionalFieldValues = {
    ...(target.professionalFieldValues ?? {}),
    [professionalFieldKey(item.field.group, item.field.label)]: item.field.value,
  };
}

export function mergeMonitorCodes(existing: string[], codes: string[]) {
  return Array.from(new Set([...existing, ...codes]));
}
