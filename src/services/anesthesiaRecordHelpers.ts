import dayjs from 'dayjs';
import type { FluidRecord, MedicationRecord, SurgeryCase, VitalSign } from '@/types/anesthesia';

type VitalKey = 'SBP' | 'DBP' | 'HR' | 'RR' | 'SpO2' | 'EtCO2' | 'TEMP' | 'BIS';

const abnormalRules: Array<{
  metric: VitalKey;
  label: string;
  low?: number;
  high?: number;
  suggestion: string;
}> = [
  { metric: 'SBP', label: '收缩压', low: 90, high: 160, suggestion: '复测血压，评估容量、麻醉深度及循环支持需要。' },
  { metric: 'DBP', label: '舒张压', low: 50, high: 100, suggestion: '关注循环灌注，必要时调整血管活性药物。' },
  { metric: 'HR', label: '心率', low: 50, high: 120, suggestion: '评估心律、麻醉深度、失血和用药影响。' },
  { metric: 'RR', label: '呼吸', low: 8, high: 25, suggestion: '检查通气参数、气道通畅和自主呼吸状态。' },
  { metric: 'SpO2', label: '血氧饱和度', low: 95, suggestion: '检查探头、氧源、气道位置和通气氧合情况。' },
  { metric: 'EtCO2', label: '呼末二氧化碳', low: 30, high: 45, suggestion: '复核通气量、循环状态和呼吸回路。' },
  { metric: 'TEMP', label: '体温', low: 35.5, high: 38.5, suggestion: '评估保温、感染和输液输血温度管理。' },
  { metric: 'BIS', label: '麻醉深度', low: 40, high: 60, suggestion: '结合血流动力学调整镇静镇痛和肌松策略。' },
];

const highAlertDrugs = ['右美托咪定', '丙泊酚', '瑞芬太尼', '去甲肾上腺素', '肾上腺素', '多巴胺'];
const bloodProductUnits: Record<string, string> = {
  血小板: '治疗量',
  白细胞: '袋',
  悬浮红细胞: 'U',
  红细胞: 'U',
  冷沉淀: 'U',
};

export interface AbnormalVitalSign {
  id: string;
  time: string;
  metric: VitalKey;
  label: string;
  value: number;
  level: 'warning' | 'danger';
  suggestion: string;
  handled: boolean;
}

export interface RecordQualityCheck {
  item: string;
  status: '通过' | '警告' | '未通过';
  message: string;
  target: string;
}

export function detectAbnormalVitalSigns(vitals: VitalSign[]): AbnormalVitalSign[] {
  return vitals.flatMap((row) =>
    abnormalRules.flatMap((rule) => {
      const value = row[rule.metric];
      if (typeof value !== 'number') return [];
      const low = typeof rule.low === 'number' && value < rule.low;
      const high = typeof rule.high === 'number' && value > rule.high;
      if (!low && !high) return [];
      return [{
        id: `${row.time}-${rule.metric}`,
        time: row.time,
        metric: rule.metric,
        label: rule.label,
        value,
        level: rule.metric === 'SpO2' || rule.metric === 'SBP' ? 'danger' : 'warning',
        suggestion: rule.suggestion,
        handled: false,
      }];
    }),
  );
}

export function normalizeMedicationPayload(payload: Partial<MedicationRecord>): Omit<MedicationRecord, 'id'> {
  const mode = payload.mode ?? '单次用药';
  const startTime = payload.startTime ?? payload.time ?? dayjs().toISOString();
  const highAlert = payload.highAlert ?? highAlertDrugs.includes(payload.drug ?? '');
  return {
    mode,
    time: mode === '单次用药' ? (payload.time ?? startTime) : payload.time,
    drug: payload.drug ?? '',
    dose: payload.dose,
    unit: payload.unit,
    route: payload.route,
    executor: payload.executor ?? '',
    concentration: payload.concentration,
    pumpRate: payload.pumpRate,
    startTime: mode === '持续泵入' ? startTime : payload.startTime,
    adjustTime: payload.adjustTime,
    stopTime: mode === '持续泵入' ? (payload.stopTime ?? dayjs(startTime).add(10, 'minute').toISOString()) : payload.stopTime,
    totalAmount: payload.totalAmount,
    checker: payload.checker ?? '',
    highAlert,
    reason: payload.reason ?? (mode === '持续泵入' ? '持续用药' : '单次用药'),
  };
}

export function normalizeTransfusionPayload(payload: Partial<FluidRecord>): Omit<FluidRecord, 'id'> {
  const name = payload.name ?? '悬浮红细胞';
  return {
    category: '血液制品',
    name,
    startTime: payload.startTime ?? dayjs().toISOString(),
    endTime: payload.endTime ?? dayjs(payload.startTime ?? undefined).add(30, 'minute').toISOString(),
    volume: payload.volume ?? 0,
    bloodType: payload.bloodType ?? '',
    rh: payload.rh ?? '',
    reaction: payload.reaction ?? '无',
    executor: payload.executor ?? '',
    bagNo: payload.bagNo ?? '',
    anesthesiaConfirm: payload.anesthesiaConfirm ?? '',
    circulatingConfirm: payload.circulatingConfirm ?? '',
    doubleCheck: Boolean(payload.anesthesiaConfirm && payload.circulatingConfirm),
  };
}

export function calculateFluidBalance(item: SurgeryCase) {
  const inputTotal = item.fluids.reduce((sum, fluid) => sum + (Number(fluid.volume) || 0), 0);
  const outputTotal = item.outputs.urine + item.outputs.bloodLoss + item.outputs.drainage;
  return {
    infusionTotal: item.fluids.filter((fluid) => fluid.category !== '血液制品').reduce((sum, fluid) => sum + fluid.volume, 0),
    transfusionTotal: item.fluids.filter((fluid) => fluid.category === '血液制品').reduce((sum, fluid) => sum + fluid.volume, 0),
    inputTotal,
    outputTotal,
    fluidBalance: inputTotal - outputTotal,
    bloodLossTotal: item.outputs.bloodLoss,
  };
}

export function buildRecordTimeScale(item: SurgeryCase) {
  const start = dayjs(item.scheduledStart ?? item.plannedStart).startOf('minute');
  const times = [
    item.scheduledEnd,
    item.surgeryEnd,
    item.leaveRoomTime,
    ...item.vitals.map((row) => row.time),
    ...item.medications.flatMap((row) => [row.time, row.startTime, row.stopTime]),
    ...item.fluids.flatMap((row) => [row.startTime, row.endTime]),
    ...item.events.map((row) => row.time),
  ].filter(Boolean) as string[];
  const latest = times.reduce((max, time) => Math.max(max, dayjs(time).diff(start, 'minute')), item.expectedDurationMinutes || 210);
  const totalMinutes = Math.ceil(Math.max(210, latest) / 30) * 30;
  const majorTicks = Array.from({ length: totalMinutes / 30 + 1 }, (_, index) => {
    const time = start.add(index * 30, 'minute');
    return { label: time.format('HH:mm'), left: (index * 30 / totalMinutes) * 100 };
  });
  return {
    start: start.format('HH:mm'),
    end: start.add(totalMinutes, 'minute').format('HH:mm'),
    totalMinutes,
    majorTicks,
  };
}

export function runRecordQualityChecks(item: SurgeryCase): RecordQualityCheck[] {
  const abnormalVitals = detectAbnormalVitalSigns(item.vitals);
  const hasIntubation = item.events.some((event) => event.type === '插管');
  const hasExtubation = item.events.some((event) => event.type === '拔管');
  const runningPump = item.medications.some((med) => med.mode === '持续泵入' && !med.stopTime);
  const highAlertMissing = item.medications.some((med) => (med.highAlert || highAlertDrugs.includes(med.drug)) && !med.checker);
  const bloodWithoutCheck = item.fluids.some((fluid) => fluid.category === '血液制品' && !fluid.doubleCheck);

  return [
    { item: '患者身份与手术信息', status: item.patientId && item.surgeryName ? '通过' : '未通过', message: item.patientId ? '已关联手术护理患者主索引' : '缺少 patientId', target: 'patient' },
    { item: '麻醉开始时间', status: item.anesthesiaStart ? '通过' : '未通过', message: item.anesthesiaStart ? '已记录' : '未记录麻醉开始', target: 'anesthesia' },
    { item: '手术开始时间', status: item.surgeryStart ? '通过' : '未通过', message: item.surgeryStart ? '已记录' : '未记录手术开始', target: 'anesthesia' },
    { item: '生命体征记录', status: item.vitals.length ? '通过' : '未通过', message: `已记录 ${item.vitals.length} 条`, target: 'vitals' },
    { item: '异常生命体征闭环', status: abnormalVitals.length ? '警告' : '通过', message: abnormalVitals.length ? `${abnormalVitals.length} 项异常需处理措施` : '暂无异常', target: 'vitals' },
    { item: '插管拔管闭环', status: hasIntubation && !hasExtubation && item.transferTo !== 'ICU' ? '未通过' : '通过', message: hasIntubation && !hasExtubation ? '有插管记录但未见拔管或带管转归说明' : '气道节点闭环', target: 'airway' },
    { item: '持续泵入停止时间', status: runningPump ? '未通过' : '通过', message: runningPump ? '存在持续泵入无停止时间' : '持续泵入均已停止或暂无', target: 'medication' },
    { item: '高警示药品核对', status: highAlertMissing ? '未通过' : '通过', message: highAlertMissing ? '高警示药品缺少核对人' : '核对完整或暂无', target: 'medication' },
    { item: '输血双人核对', status: bloodWithoutCheck ? '未通过' : '通过', message: bloodWithoutCheck ? '血液制品未完成双人核对' : '核对完整或暂无输血', target: 'transfusion' },
    { item: '医护签名', status: item.locked || item.preVisit.doctorSignature ? '通过' : '警告', message: item.locked ? '记录已锁定' : '签名前请复核麻醉医师、护士签名', target: 'signature' },
  ];
}

export function getBloodProductUnit(name: string) {
  return bloodProductUnits[name] ?? 'ml';
}
