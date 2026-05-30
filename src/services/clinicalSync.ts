import dayjs from 'dayjs';
import {
  anesthesiaCases as seedCases,
  anesthesiaEvents as seedEvents,
  anesthesiaMedications as seedMedications,
  anesthesiaStaff as seedStaff,
  fluidBloodRecords as seedFluids,
  pacuRecords as seedPacu,
  postoperativeFollowups as seedFollowups,
  preAnesthesiaVisits as seedPreVisits,
  vitalSignRecords as seedVitals,
  warmingRecords as seedWarming,
  airwayRecords as seedAirway,
  patients as seedPatients,
  caseStaff as seedCaseStaff,
  anesthesiaMachineRecords as seedMachine,
} from '@/mock/qualitySeed';
import { anesthesiaCases as legacyCases, pacuPatients as legacyPacu, postoperativeFollowUps as legacyFollowUps } from '@/mock/anesthesiaCases';
import type { PacuPatient, PostoperativeFollowUp, SurgeryCase, VitalSign } from '@/types/anesthesia';
import type {
  AnesthesiaCaseTable,
  AnesthesiaEventTable,
  FluidBloodTable,
  MedicationTable,
  PacuRecordTable,
  PostoperativeFollowupTable,
  PreAnesthesiaVisitTable,
  QualityDataset,
  VitalSignRecordTable,
  WarmingRecordTable,
  AirwayRecordTable,
} from '@/types/mockTables';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function cloneQualityDataset(): QualityDataset {
  return {
    cases: clone(seedCases),
    patients: clone(seedPatients),
    staff: clone(seedStaff),
    caseStaff: clone(seedCaseStaff),
    preVisits: clone(seedPreVisits),
    vitalSigns: clone(seedVitals),
    machineRecords: clone(seedMachine),
    medications: clone(seedMedications),
    fluidBloodRecords: clone(seedFluids),
    events: clone(seedEvents),
    pacuRecords: clone(seedPacu),
    postoperativeFollowups: clone(seedFollowups),
    warmingRecords: clone(seedWarming),
    airwayRecords: clone(seedAirway),
  };
}

const staffIdByName = (dataset: QualityDataset, name: string) =>
  dataset.staff.find((item) => item.staffName === name)?.staffId ?? 'n-001';

const eventStageMap: Record<string, AnesthesiaEventTable['eventStage']> = {
  术前: '诱导',
  入室后: '诱导',
  诱导期: '诱导',
  术中: '维持',
  苏醒期: '苏醒',
  PACU: 'PACU',
  术后: '术后',
};

const fluidCategoryMap: Record<string, FluidBloodTable['recordType']> = {
  晶体液: '晶体液',
  胶体液: '胶体液',
  血液制品: '血制品',
  自体血回输: '自体血',
};

const statusMap: Record<SurgeryCase['status'], string> = {
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

export function syncCaseToDataset(dataset: QualityDataset, clinical: SurgeryCase) {
  const existing = dataset.cases.find((item) => item.caseId === clinical.id);
  const patientId = existing?.patientId ?? `p-${clinical.id}`;
  const isGeneral = clinical.anesthesiaMethod.includes('全麻') || clinical.anesthesiaMethod.includes('静脉');
  const isNeuraxial = clinical.anesthesiaMethod.includes('椎管内');
  const isRegional = clinical.anesthesiaMethod.includes('阻滞');
  const surgeryType = clinical.urgency === '急诊' ? '急诊' : clinical.department.includes('产科') ? '产科' : '择期';
  const cancelEvent = clinical.events.find((event) => event.type.includes('取消'));
  const cancelStage = clinical.cancelStage
    ?? (cancelEvent?.type.includes('麻醉开始后') ? '麻醉开始后手术前' : cancelEvent ? '入室后手术前' : existing?.cancelStage);
  const cancelReason = clinical.cancelReason ?? cancelEvent?.treatment ?? existing?.cancelReason;
  const isVaginalDelivery = clinical.isVaginalDelivery
    ?? existing?.isVaginalDelivery
    ?? (clinical.surgeryName.includes('阴道分娩')
      || (clinical.department.includes('产科') && clinical.anesthesiaMethod.includes('椎管内') && !clinical.surgeryName.includes('剖宫产')));

  const row: AnesthesiaCaseTable = {
    caseId: clinical.id,
    patientId,
    visitId: existing?.visitId ?? `v-${clinical.id}`,
    hospitalId: existing?.hospitalId ?? 'h-001',
    departmentId: existing?.departmentId ?? 'dept',
    departmentName: clinical.department,
    operatingRoomId: clinical.room,
    anesthesiaLocation: clinical.locationType === '手术室外' ? '室外麻醉点' : '中心手术室',
    locationType: clinical.locationType,
    surgeryType: surgeryType as AnesthesiaCaseTable['surgeryType'],
    operationName: clinical.surgeryName,
    diagnosis: clinical.diagnosis,
    asaLevel: clinical.asa,
    anesthesiaMethod: clinical.anesthesiaMethod,
    isGeneralAnesthesia: isGeneral,
    isRegionalAnesthesia: isRegional,
    isNeuraxialAnesthesia: isNeuraxial,
    isObstetric: clinical.department.includes('产科'),
    isVaginalDelivery,
    status: statusMap[clinical.status] ?? clinical.status,
    scheduledStartTime: clinical.plannedStart,
    roomInTime: clinical.roomInTime ?? clinical.events.find((e) => e.type === '入室' || e.type.includes('入室'))?.time ?? clinical.plannedStart,
    anesthesiaStartTime: clinical.anesthesiaStart,
    operationStartTime: clinical.surgeryStart,
    operationEndTime: clinical.surgeryEnd,
    anesthesiaEndTime: clinical.anesthesiaEnd,
    roomOutTime: clinical.leaveRoomTime,
    isTransferIcu: clinical.transferTo === 'ICU' || clinical.events.some((e) => e.type === '非计划转ICU'),
    transferIcuPlanned: clinical.transferIcuPlanned ?? existing?.transferIcuPlanned ?? false,
    transferIcuReason: clinical.events.find((e) => e.type === '非计划转ICU')?.treatment,
    isDeleted: false,
    isTest: false,
    createdAt: existing?.createdAt ?? clinical.plannedStart,
    updatedAt: dayjs().toISOString(),
    cancelTime: clinical.status === '已取消' ? (cancelEvent?.time ?? existing?.cancelTime) : existing?.cancelTime,
    cancelStage: clinical.status === '已取消' ? (cancelStage as AnesthesiaCaseTable['cancelStage']) : undefined,
    cancelReason: clinical.status === '已取消' ? cancelReason : undefined,
  };

  if (existing) Object.assign(existing, row);
  else dataset.cases.push(row);

  const patient = dataset.patients.find((item) => item.patientId === patientId);
  if (patient) {
    patient.name = clinical.patientName;
    patient.gender = clinical.gender;
    patient.age = clinical.age;
    patient.height = clinical.preVisit.height;
    patient.weight = clinical.preVisit.weight;
    patient.bmi = Number((clinical.preVisit.weight / ((clinical.preVisit.height / 100) ** 2)).toFixed(1));
    patient.allergyHistory = clinical.preVisit.allergy;
    patient.departmentName = clinical.department;
  }

  const visit: PreAnesthesiaVisitTable = {
    visitId: `pre-${clinical.id}`,
    caseId: clinical.id,
    visitTime: clinical.preVisit.completed ? dayjs(clinical.plannedStart).subtract(1, 'hour').toISOString() : undefined,
    visitDoctorId: staffIdByName(dataset, clinical.anesthesiologist),
    asaLevel: clinical.preVisit.asa,
    airwayAssessment: clinical.preVisit.difficultAirway,
    fastingStatus: clinical.preVisit.fasting,
    anesthesiaPlan: clinical.preVisit.plan,
    informedConsent: clinical.preVisit.completed,
    isCompleted: clinical.preVisit.completed,
    completedTime: clinical.preVisit.completed ? dayjs(clinical.plannedStart).subtract(45, 'minute').toISOString() : undefined,
  };
  const visitIndex = dataset.preVisits.findIndex((item) => item.caseId === clinical.id);
  if (visitIndex >= 0) dataset.preVisits[visitIndex] = visit;
  else dataset.preVisits.push(visit);

  dataset.vitalSigns = dataset.vitalSigns.filter((item) => item.caseId !== clinical.id);
  clinical.vitals.forEach((vital, index) => {
    dataset.vitalSigns.push(vitalToRecord(clinical.id, vital, index, clinical.anesthesiaNurse));
  });

  dataset.machineRecords = dataset.machineRecords.filter((item) => item.caseId !== clinical.id);
  clinical.vitals
    .filter((vital) => typeof vital.EtCO2 === 'number')
    .forEach((vital, index) => {
      dataset.machineRecords.push({
        recordId: `am-${clinical.id}-${index}`,
        caseId: clinical.id,
        recordTime: vital.time,
        fio2: 50,
        etco2: vital.EtCO2,
        vt: 450,
        mv: 6.2,
        rrSet: 12,
        peep: 5,
        ppeak: 18,
        source: '麻醉机采集',
      });
    });

  dataset.medications = dataset.medications.filter((item) => item.caseId !== clinical.id);
  clinical.medications.forEach((med) => {
    dataset.medications.push({
      medicationId: med.id,
      caseId: clinical.id,
      medicationType: med.mode === '持续泵入' ? '持续泵入' : '单次用药',
      drugName: med.drug,
      dose: med.dose,
      doseUnit: med.unit,
      concentration: med.concentration,
      infusionRate: med.pumpRate,
      route: med.route,
      startTime: med.startTime ?? med.time,
      adjustTime: med.adjustTime,
      stopTime: med.stopTime,
      totalAmount: med.totalAmount,
      executorId: staffIdByName(dataset, med.executor),
      source: med.mode === '持续泵入' ? '输注泵采集' : '手工',
    });
  });

  dataset.fluidBloodRecords = dataset.fluidBloodRecords.filter((item) => item.caseId !== clinical.id);
  clinical.fluids.forEach((fluid) => {
    dataset.fluidBloodRecords.push({
      recordId: fluid.id,
      caseId: clinical.id,
      recordType: fluidCategoryMap[fluid.category] ?? '晶体液',
      name: fluid.name,
      volume: fluid.volume,
      unit: 'ml',
      startTime: fluid.startTime,
      endTime: fluid.endTime,
      bloodType: fluid.bloodType,
      rh: fluid.rh,
      adverseReaction: fluid.reaction,
      executorId: staffIdByName(dataset, fluid.executor),
    });
  });

  const preservedEvents = dataset.events.filter((item) => item.caseId !== clinical.id);
  const clinicalEvents: AnesthesiaEventTable[] = clinical.events.map((event, index) => ({
    eventId: event.id || `ev-${clinical.id}-${index}`,
    caseId: clinical.id,
    eventType: event.type,
    eventCode: event.type.slice(0, 3).toUpperCase(),
    eventTime: event.time,
    eventStage: eventStageMap[event.stage] ?? '维持',
    severity: event.severity,
    description: event.type,
    treatment: event.treatment,
    relatedToAnesthesia: true,
    isQualityEvent: event.qualityIncluded,
    reported: event.reported,
    reviewStatus: event.treatment ? '已确认' : '待审核',
  }));
  dataset.events = [...preservedEvents, ...clinicalEvents];

  syncAirwayFromClinical(dataset, clinical);

  if (clinical.activeWarming) {
    const warming: WarmingRecordTable = {
      recordId: `wr-${clinical.id}`,
      caseId: clinical.id,
      warmingType: '暖风毯',
      startTime: clinical.anesthesiaStart ?? clinical.plannedStart,
      endTime: clinical.leaveRoomTime,
    };
    dataset.warmingRecords = dataset.warmingRecords.filter((item) => item.caseId !== clinical.id);
    dataset.warmingRecords.push(warming);
  }

  if (clinical.rescue) {
    const rescueEvent = dataset.events.find((item) => item.caseId === clinical.id && item.eventType === '抢救');
    if (rescueEvent) {
      rescueEvent.treatment = [clinical.rescue.measures, clinical.rescue.medications].filter(Boolean).join('；');
      rescueEvent.reviewStatus = clinical.rescue.endTime ? '已确认' : '待审核';
    }
  }
}

function syncAirwayFromClinical(dataset: QualityDataset, clinical: SurgeryCase) {
  const intubationEvent = clinical.events.find((event) => event.type.includes('插管') || event.type.includes('喉罩'));
  const extubationEvent = clinical.events.find((event) => event.type.includes('拔管') || event.type.includes('拔除喉罩'));
  const airway = clinical.airwayRecord;
  const intubationTime = airway?.intubationTime ?? intubationEvent?.time;
  const extubationTime = airway?.extubationTime ?? extubationEvent?.time;
  if (!intubationTime && !extubationTime) return;

  const row: AirwayRecordTable = {
    recordId: `airway-${clinical.id}`,
    caseId: clinical.id,
    airwayType: intubationEvent?.type.includes('喉罩') ? '喉罩' : intubationTime ? '气管插管' : '无',
    intubationTime,
    extubationTime,
    unplanned: clinical.events.some((event) => event.type.includes('非计划') && event.type.includes('插管')),
  };
  dataset.airwayRecords = dataset.airwayRecords.filter((item) => item.caseId !== clinical.id);
  dataset.airwayRecords.push(row);
}

function vitalToRecord(caseId: string, vital: VitalSign, index: number, nurse: string): VitalSignRecordTable {
  return {
    recordId: `vs-${caseId}-${index}`,
    caseId,
    recordTime: vital.time,
    source: '手工',
    hr: vital.HR,
    sbp: vital.SBP,
    dbp: vital.DBP,
    spo2: vital.SpO2,
    etco2: vital.EtCO2,
    temp: vital.TEMP,
    createdBy: nurse,
  };
}

export function syncPacuToDataset(dataset: QualityDataset, pacu: PacuPatient) {
  const row: PacuRecordTable = {
    pacuId: pacu.id,
    caseId: pacu.caseId,
    pacuInTime: pacu.inTime,
    pacuOutTime: pacu.outTime,
    firstTemp: pacu.firstTemperature,
    aldreteScoreIn: pacu.aldrete,
    aldreteScoreOut: pacu.status === '已转出' ? pacu.aldrete : undefined,
    vasScore: pacu.vas,
    nauseaVomiting: pacu.nausea,
    shivering: pacu.shivering,
    agitation: pacu.agitation,
    reintubation: pacu.reintubation,
    outDestination: pacu.transferTo,
    handoverNurseId: staffIdByName(dataset, pacu.handover),
  };
  const index = dataset.pacuRecords.findIndex((item) => item.pacuId === pacu.id || item.caseId === pacu.caseId);
  if (index >= 0) dataset.pacuRecords[index] = row;
  else dataset.pacuRecords.push(row);

  const caseRow = dataset.cases.find((item) => item.caseId === pacu.caseId);
  if (caseRow) {
    caseRow.pacuInTime = pacu.inTime;
    caseRow.pacuOutTime = pacu.outTime;
    caseRow.updatedAt = dayjs().toISOString();
  }
}

export function syncFollowUpToDataset(dataset: QualityDataset, followUp: PostoperativeFollowUp) {
  const row: PostoperativeFollowupTable = {
    followupId: followUp.id,
    caseId: followUp.caseId,
    followupType: followUp.type,
    followupTime: followUp.followTime,
    vasScore: followUp.vas,
    nauseaVomiting: followUp.nausea,
    headache: followUp.headache,
    hoarseness: followUp.hoarseness,
    hoarsenessDurationHours: followUp.hoarsenessDurationHours ?? (followUp.hoarseness ? 24 : undefined),
    neuroComplication: followUp.numbness || followUp.motorDisorder,
    neuroDurationHours: followUp.neuroDurationHours ?? ((followUp.numbness || followUp.motorDisorder) ? 48 : undefined),
    awareness: followUp.awareness,
    respiratoryDepression: followUp.respiratoryDepression,
    reintubation: followUp.reintubation,
    transferredIcu: followUp.transferredIcu,
    newComa: followUp.newComa ?? false,
    death24h: followUp.death,
    advice: followUp.advice,
  };
  const index = dataset.postoperativeFollowups.findIndex((item) => item.followupId === followUp.id);
  if (index >= 0) dataset.postoperativeFollowups[index] = row;
  else dataset.postoperativeFollowups.push(row);
}

export function syncAllClinicalToDataset(
  dataset: QualityDataset,
  cases: SurgeryCase[],
  pacuPatients: PacuPatient[],
  followUps: PostoperativeFollowUp[],
) {
  cases.forEach((item) => syncCaseToDataset(dataset, item));
  pacuPatients.forEach((item) => syncPacuToDataset(dataset, item));
  followUps.forEach((item) => syncFollowUpToDataset(dataset, item));
}

export function buildInitialClinicalState() {
  return {
    cases: clone(legacyCases),
    pacuPatients: clone(legacyPacu),
    followUps: clone(legacyFollowUps),
  };
}

export function exportQualityCsv(indicators: Array<{ code: string; name: string; displayValue: string; numerator: number; denominator: number }>) {
  const header = '指标编码,指标名称,当前值,分子,分母\n';
  const rows = indicators.map((item) => `${item.code},${item.name},${item.displayValue},${item.numerator},${item.denominator}`).join('\n');
  return header + rows;
}

export function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['\ufeff', content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
