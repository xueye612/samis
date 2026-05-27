import dayjs from 'dayjs';
import type { AnesthesiaCaseTable, PacuRecordTable, QualityDataset } from '@/types/mockTables';
import type { QualityDefect } from '@/types/quality';

const patientName = (dataset: QualityDataset, caseId: string) => {
  const target = dataset.cases.find((item) => item.caseId === caseId);
  const patient = dataset.patients.find((item) => item.patientId === target?.patientId);
  return patient?.name ?? caseId;
};

const doctorName = (dataset: QualityDataset, caseId: string) => {
  const relation = dataset.caseStaff.find((item) => item.caseId === caseId && item.role === '主麻');
  return dataset.staff.find((item) => item.staffId === relation?.staffId)?.staffName ?? '未指定';
};

const caseRoom = (dataset: QualityDataset, caseId: string) => dataset.cases.find((item) => item.caseId === caseId)?.operatingRoomId ?? '-';

const addDefect = (
  defects: QualityDefect[],
  dataset: QualityDataset,
  caseId: string,
  defectType: string,
  defectLevel: QualityDefect['defectLevel'],
  source: string,
  defectDesc: string,
  status: QualityDefect['status'] = '待整改',
) => {
  defects.push({
    defectId: `defect-${caseId}-${defects.length + 1}`,
    caseId,
    patientName: patientName(dataset, caseId),
    room: caseRoom(dataset, caseId),
    defectType,
    defectLevel,
    defectDesc,
    responsibleStaff: doctorName(dataset, caseId),
    discoveredTime: dayjs().toISOString(),
    status,
    rectificationNote: status === '已整改' ? '已补充说明并复核。' : '待责任人补充记录并提交复核。',
    reviewer: status === '待确认' ? '质控护士' : '质控管理员',
    reviewTime: status === '已整改' ? dayjs().toISOString() : undefined,
    source,
  });
};

const operationDuration = (item: AnesthesiaCaseTable) => {
  if (!item.operationStartTime) return 0;
  const end = item.operationEndTime ?? dayjs(item.operationStartTime).add(180, 'minute').toISOString();
  return dayjs(end).diff(dayjs(item.operationStartTime), 'minute');
};

const stayMinutes = (item: PacuRecordTable) => dayjs(item.pacuOutTime ?? new Date()).diff(dayjs(item.pacuInTime), 'minute');

const maxGapMinutes = (times: string[]) => {
  if (times.length < 2) return 0;
  const sorted = [...times].sort();
  let max = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    const gap = dayjs(sorted[i]).diff(dayjs(sorted[i - 1]), 'minute');
    if (gap > max) max = gap;
  }
  return max;
};

export function detectQualityDefects(dataset: QualityDataset): QualityDefect[] {
  const defects: QualityDefect[] = [];
  const followedCases = new Set(dataset.postoperativeFollowups.map((item) => item.caseId));

  dataset.cases
    .filter((item) => !item.isDeleted && !item.isTest)
    .forEach((item) => {
      const vitals = dataset.vitalSigns.filter((record) => record.caseId === item.caseId);
      const hasTemp = vitals.some((record) => typeof record.temp === 'number');
      const preVisit = dataset.preVisits.find((visit) => visit.caseId === item.caseId);
      const airway = dataset.airwayRecords.find((record) => record.caseId === item.caseId);
      const bpTimes = vitals.filter((record) => record.sbp || record.hr).map((record) => record.recordTime);
      const spo2Times = vitals.filter((record) => typeof record.spo2 === 'number').map((record) => record.recordTime);
      const etco2Records = dataset.machineRecords.filter((record) => record.caseId === item.caseId && record.etco2);

      if (item.surgeryType === '择期' && !preVisit?.isCompleted) {
        addDefect(defects, dataset, item.caseId, '择期手术未完成术前访视', '重要', 'pre_anesthesia_visit', '择期手术应在麻醉前完成访视、评估和知情同意。');
      }
      if (item.isGeneralAnesthesia && !hasTemp) {
        addDefect(defects, dataset, item.caseId, '全麻无体温记录', '重要', 'vital_sign_record', '全麻病例应记录术中体温。');
      }
      if (item.isGeneralAnesthesia && operationDuration(item) > 120 && !hasTemp) {
        addDefect(defects, dataset, item.caseId, '手术超过120分钟无体温', '严重', 'anesthesia_case + vital_sign_record', '预计或实际手术超过120分钟时，应记录体温。');
      }
      if (item.isGeneralAnesthesia && bpTimes.length >= 2 && maxGapMinutes(bpTimes) > 5) {
        addDefect(defects, dataset, item.caseId, '血压脉搏记录间隔超过5分钟', '重要', 'vital_sign_record', `血压/脉搏最大记录间隔${maxGapMinutes(bpTimes)}分钟。`);
      }
      if (item.isGeneralAnesthesia && spo2Times.length >= 2 && maxGapMinutes(spo2Times) > 15) {
        addDefect(defects, dataset, item.caseId, 'SpO₂记录间隔超过15分钟', '重要', 'vital_sign_record', `SpO₂最大记录间隔${maxGapMinutes(spo2Times)}分钟。`);
      }
      if (item.isGeneralAnesthesia && etco2Records.length >= 2) {
        const etco2Gap = maxGapMinutes(etco2Records.map((record) => record.recordTime));
        if (etco2Gap > 30) {
          addDefect(defects, dataset, item.caseId, 'EtCO₂记录间隔超过30分钟', '重要', 'anesthesia_machine_record', `EtCO₂最大记录间隔${etco2Gap}分钟。`);
        }
      }
      if (dataset.medications.some((record) => record.caseId === item.caseId && record.medicationType === '持续泵入' && !record.stopTime)) {
        addDefect(defects, dataset, item.caseId, '连续泵入药物无停止时间', '重要', 'anesthesia_medication', '持续泵入药物应记录停止时间和累计量。');
      }
      if (airway?.intubationTime && !airway.extubationTime && !item.isTransferIcu) {
        addDefect(defects, dataset, item.caseId, '插管有记录但拔管无记录', '重要', 'anesthesia_event / airway_record', '插管病例应记录拔管时间或带管转运说明。');
      }
      if (item.operationName.includes('置换') && !followedCases.has(item.caseId)) {
        addDefect(defects, dataset, item.caseId, '术后镇痛患者未随访', '重要', 'postoperative_followup', '术后镇痛患者应完成VAS评分和不良反应随访。');
      }
      dataset.events
        .filter((event) => event.caseId === item.caseId && event.isQualityEvent && event.severity !== '轻度' && !event.treatment)
        .forEach((event) => {
          addDefect(defects, dataset, item.caseId, event.eventType === '抢救' ? '抢救记录未补记' : '特殊事件无处理措施', '严重', 'anesthesia_event', `${event.eventType}事件缺少处理措施或抢救补记。`, '待确认');
        });
    });

  dataset.pacuRecords.forEach((item) => {
    if (typeof item.firstTemp === 'number' && item.firstTemp < 36) {
      addDefect(defects, dataset, item.caseId, 'PACU入室低体温', '重要', 'pacu_record', `PACU入室首次体温${item.firstTemp}℃，需记录复温措施。`);
    }
    if (typeof item.firstTemp !== 'number') {
      addDefect(defects, dataset, item.caseId, 'PACU入室无首次体温', '重要', 'pacu_record', 'PACU入室应记录首次体温。');
    }
    if (stayMinutes(item) > 120) {
      addDefect(defects, dataset, item.caseId, 'PACU停留超过2小时', '严重', 'pacu_record', `PACU停留${stayMinutes(item)}分钟，需说明转出延迟原因。`);
    }
  });

  return defects;
}

export function applyDefectOverrides(defects: QualityDefect[], overrides: Record<string, Partial<QualityDefect>>) {
  return defects.map((item) => ({ ...item, ...(overrides[item.defectId] ?? {}) }));
}
