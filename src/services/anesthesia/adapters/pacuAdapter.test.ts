import { describe, expect, it } from 'vitest';
import {
  buildPacuAdmitPayload,
  buildPacuTransferOutPayload,
  buildPacuUpdatePayload,
  mapPacuListResponse,
  mapPacuRecordToPatient,
  type PacuRecordApi,
} from '@/services/anesthesia/adapters/pacuAdapter';

const sampleRow: PacuRecordApi = {
  id: 12,
  caseId: 'CASE-1',
  operationId: 'CASE-1',
  patientName: '张三',
  room: 'OR-01',
  bedNo: 'P-3',
  pacuInTime: '2026-07-05 10:00:00',
  pacuOutTime: null,
  firstTemp: 35.6,
  hr: 88,
  bp: '120/78',
  spo2: 97,
  rr: 16,
  aldreteIn: 8,
  aldreteOut: null,
  vasScore: 3,
  nauseaVomiting: false,
  shivering: true,
  agitation: false,
  reintubation: false,
  status: '观察中',
  outDestination: null,
  handoverNurseId: null,
};

describe('pacuAdapter', () => {
  it('mapPacuRecordToPatient maps backend row to PacuPatient', () => {
    const patient = mapPacuRecordToPatient(sampleRow);
    expect(patient.id).toBe('12');
    expect(patient.caseId).toBe('CASE-1');
    expect(patient.inTime).toBe('2026-07-05 10:00:00');
    expect(patient.firstTemperature).toBe(35.6);
    expect(patient.aldrete).toBe(8);
    expect(patient.shivering).toBe(true);
    expect(patient.status).toBe('观察中');
    expect(patient.transferTo).toBe('病房');
  });

  it('mapPacuListResponse reads list + total', () => {
    const { list, total } = mapPacuListResponse({ list: [sampleRow], total: 1 });
    expect(total).toBe(1);
    expect(list[0].caseId).toBe('CASE-1');
  });

  it('mapPacuListResponse tolerates missing shape', () => {
    const { list, total } = mapPacuListResponse(undefined);
    expect(list).toEqual([]);
    expect(total).toBe(0);
  });

  it('buildPacuAdmitPayload maps patient fields to backend keys', () => {
    const payload = buildPacuAdmitPayload({
      caseId: 'CASE-1',
      patientName: '张三',
      room: 'OR-01',
      firstTemperature: 36.0,
      aldrete: 9,
      hr: 70,
      pacuInTime: '2026-07-05 10:00:00',
    });
    expect(payload.caseId).toBe('CASE-1');
    expect(payload.firstTemp).toBe(36.0);
    expect(payload.aldreteIn).toBe(9);
    expect(payload.pacuInTime).toBe('2026-07-05 10:00:00');
    expect(payload).not.toHaveProperty('operationId');
  });

  it('buildPacuUpdatePayload maps partial patient patch', () => {
    const payload = buildPacuUpdatePayload({
      aldrete: 10,
      SpO2: 99,
      status: '待转出',
      shivering: false,
    });
    expect(payload.aldreteIn).toBe(10);
    expect(payload.spo2).toBe(99);
    expect(payload.status).toBe('待转出');
    expect(payload.shivering).toBe(false);
    expect(payload).not.toHaveProperty('hr');
  });

  it('buildPacuTransferOutPayload builds transfer keys', () => {
    const payload = buildPacuTransferOutPayload({
      id: 12,
      outDestination: 'ICU',
      aldreteOut: 10,
    });
    expect(payload.id).toBe(12);
    expect(payload.outDestination).toBe('ICU');
    expect(payload.aldreteOut).toBe(10);
    expect(typeof payload.pacuOutTime).toBe('string');
  });
});
