import type { SurgeryCase } from '@/types/anesthesia';

export type RecordActionCase = Pick<
  SurgeryCase,
  | 'anesthesiaStart'
  | 'anesthesiaEnd'
  | 'roomInTime'
  | 'leaveRoomTime'
  | 'surgeryStart'
  | 'surgeryEnd'
  | 'recordStatus'
  | 'locked'
  | 'signatures'
>;

export type RecordWorkflowPhase =
  | 'not_started'
  | 'recording'
  | 'collecting'
  | 'completed'
  | 'awaiting_signature'
  | 'locked'
  | 'signed'
  | 'rescue';

export interface RecordActionVisibility {
  phase: RecordWorkflowPhase;
  showStartRecord: boolean;
  showEndRecord: boolean;
  showSaveDraft: boolean;
  showRescue: boolean;
  showExitRescue: boolean;
  showSubmitSignature: boolean;
  showUnlock: boolean;
  showPrint: boolean;
  showQualityCheck: boolean;
  showConflictAction: boolean;
  showDeviceControls: boolean;
  primaryLabel: string;
  primaryDisabled: boolean;
  primaryType: 'primary' | 'outline';
  primaryAction: 'start' | 'end' | 'none';
}

export interface RecordEndValidationOptions {
  deviceSessionActive: boolean;
  rescueActive: boolean;
}

export type RecordEndValidationResult =
  | { ok: true }
  | { ok: false; message: string };

const recordTimeValue = (value: string | undefined, reference: string): number | null => {
  if (!value) return null;
  if (/^\d{2}:\d{2}(?::\d{2})?$/.test(value)) {
    const date = reference.slice(0, 10);
    const clock = value.length === 5 ? `${value}:00` : value;
    const parsed = Date.parse(`${date}T${clock}`);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const CRITICAL_RECORD_TIMES: Array<{
  field: 'roomInTime' | 'anesthesiaStart' | 'surgeryStart' | 'surgeryEnd' | 'anesthesiaEnd' | 'leaveRoomTime';
  label: string;
}> = [
  { field: 'roomInTime', label: '入室' },
  { field: 'anesthesiaStart', label: '麻醉开始' },
  { field: 'surgeryStart', label: '手术开始' },
  { field: 'surgeryEnd', label: '手术结束' },
  { field: 'anesthesiaEnd', label: '麻醉结束' },
  { field: 'leaveRoomTime', label: '离室' },
];

/**
 * 记录单生命周期结束与“麻醉结束”临床事件是两件事。
 * 只有六个关键临床时间完整且按显式日期顺序排列，才允许结束记录。
 */
export const isRecordReadyToEnd = (
  item: RecordActionCase | undefined,
): RecordEndValidationResult => {
  if (!item) return { ok: false, message: '麻醉记录单不存在。' };
  const missing = CRITICAL_RECORD_TIMES.filter(({ field }) => !item[field]);
  if (missing.length) {
    return { ok: false, message: `请先补齐关键时间：${missing.map(({ label }) => label).join('、')}。` };
  }

  let previous: { value: number; label: string } | null = null;
  for (const { field, label } of CRITICAL_RECORD_TIMES) {
    const raw = item[field];
    const value = raw ? Date.parse(raw) : Number.NaN;
    if (!Number.isFinite(value)) return { ok: false, message: `${label}时间格式不正确。` };
    if (previous && value < previous.value) {
      return { ok: false, message: `${label}时间不能早于${previous.label}时间。` };
    }
    previous = { value, label };
  }
  return { ok: true };
};

/** 结束记录只校验记录生命周期；设备停止由独立设备动作完成，禁止静默代办。 */
export const validateRecordEnd = (
  item: RecordActionCase | undefined,
  endAt: string,
  options: RecordEndValidationOptions,
): RecordEndValidationResult => {
  if (!item) return { ok: false, message: '麻醉记录单不存在。' };
  if (item.locked) return { ok: false, message: '麻醉记录已锁定，无法结束记录。' };
  if (item.recordStatus === '待签名' || item.recordStatus === '已完成') {
    return { ok: false, message: '麻醉记录已经结束，请勿重复操作。' };
  }
  if (options.rescueActive) return { ok: false, message: '当前处于抢救状态，请先退出抢救后再结束记录。' };
  if (options.deviceSessionActive) {
    return { ok: false, message: '设备采集尚未停止，请先停止设备采集后再结束记录。' };
  }
  if (item.recordStatus !== '采集中') return { ok: false, message: '当前记录状态不允许结束。' };

  const timeline = isRecordReadyToEnd(item);
  if (!timeline.ok) return timeline;

  const endValue = recordTimeValue(endAt, endAt);
  if (endValue === null) return { ok: false, message: '记录结束时间格式不正确。' };
  const leaveRoomValue = recordTimeValue(item.leaveRoomTime, endAt);
  if (leaveRoomValue !== null && endValue < leaveRoomValue) {
    return { ok: false, message: '记录结束时间不能早于离室时间。' };
  }
  return { ok: true };
};

/** 纸面/侧栏录入类操作可见性（与顶部主按钮规则一致） */
export interface RecordEntryVisibility {
  canEdit: boolean;
  canQuickEvent: boolean;
  canMedication: boolean;
  canFluid: boolean;
  canTransfusion: boolean;
  canVital: boolean;
  canOutput: boolean;
  canLab: boolean;
  canDeviceControl: boolean;
  canRescue: boolean;
}

export const buildRecordEntryVisibility = (
  item: RecordActionCase | undefined,
  rescueActive: boolean,
): RecordEntryVisibility => {
  const actions = buildRecordActionVisibility(item, rescueActive);
  const locked = Boolean(item?.locked);
  if (locked) {
    return {
      canEdit: false,
      canQuickEvent: false,
      canMedication: false,
      canFluid: false,
      canTransfusion: false,
      canVital: false,
      canOutput: false,
      canLab: false,
      canDeviceControl: false,
      canRescue: false,
    };
  }
  if (actions.phase === 'not_started' || actions.phase === 'completed' || actions.phase === 'awaiting_signature') {
    return {
      canEdit: false,
      canQuickEvent: false,
      canMedication: false,
      canFluid: false,
      canTransfusion: false,
      canVital: false,
      canOutput: false,
      canLab: false,
      canDeviceControl: false,
      canRescue: false,
    };
  }
  return {
    canEdit: true,
    canQuickEvent: true,
    canMedication: true,
    canFluid: true,
    canTransfusion: true,
    canVital: true,
    canOutput: true,
    canLab: true,
    canDeviceControl: actions.showDeviceControls,
    canRescue: actions.showRescue,
  };
};

export const resolveRecordWorkflowPhase = (
  item: RecordActionCase | undefined,
  rescueActive: boolean,
): RecordWorkflowPhase => {
  if (!item) return 'not_started';
  if (rescueActive) return 'rescue';
  if (item.locked) {
    return item.signatures?.status === '已签名' ? 'signed' : 'locked';
  }
  const status = item.recordStatus ?? (item.anesthesiaStart ? '采集中' : '未开始');
  if (status === '未开始') return 'not_started';
  if (status === '待签名') return 'awaiting_signature';
  if (status === '已完成') return 'completed';
  if (status === '采集中' || status === '补记中') return 'collecting';
  return 'recording';
};

export const buildRecordActionVisibility = (
  item: RecordActionCase | undefined,
  rescueActive: boolean,
): RecordActionVisibility => {
  const phase = resolveRecordWorkflowPhase(item, rescueActive);
  const locked = Boolean(item?.locked);
  const signed = item?.signatures?.status === '已签名';

  if (phase === 'not_started') {
    return {
      phase,
      showStartRecord: true,
      showEndRecord: false,
      showSaveDraft: false,
      showRescue: false,
      showExitRescue: false,
      showSubmitSignature: false,
      showUnlock: false,
      showPrint: true,
      showQualityCheck: true,
      showConflictAction: false,
      showDeviceControls: false,
      primaryLabel: '启动记录',
      primaryDisabled: false,
      primaryType: 'primary',
      primaryAction: 'start',
    };
  }

  if (phase === 'locked' || phase === 'signed') {
    return {
      phase,
      showStartRecord: false,
      showEndRecord: false,
      showSaveDraft: false,
      showRescue: false,
      showExitRescue: false,
      showSubmitSignature: false,
      showUnlock: true,
      showPrint: true,
      showQualityCheck: true,
      showConflictAction: true,
      showDeviceControls: false,
      primaryLabel: signed ? '已签名' : '已锁定',
      primaryDisabled: true,
      primaryType: 'outline',
      primaryAction: 'none',
    };
  }

  if (phase === 'rescue') {
    return {
      phase,
      showStartRecord: false,
      showEndRecord: false,
      showSaveDraft: true,
      showRescue: false,
      showExitRescue: !locked,
      showSubmitSignature: false,
      showUnlock: false,
      showPrint: true,
      showQualityCheck: true,
      showConflictAction: true,
      showDeviceControls: true,
      primaryLabel: '抢救中',
      primaryDisabled: true,
      primaryType: 'outline',
      primaryAction: 'none',
    };
  }

  if (phase === 'completed') {
    return {
      phase,
      showStartRecord: false,
      showEndRecord: false,
      showSaveDraft: false,
      showRescue: false,
      showExitRescue: false,
      showSubmitSignature: !signed,
      showUnlock: false,
      showPrint: true,
      showQualityCheck: true,
      showConflictAction: true,
      showDeviceControls: false,
      primaryLabel: '已完成',
      primaryDisabled: true,
      primaryType: 'outline',
      primaryAction: 'none',
    };
  }

  if (phase === 'awaiting_signature') {
    return {
      phase,
      showStartRecord: false,
      showEndRecord: false,
      showSaveDraft: false,
      showRescue: false,
      showExitRescue: false,
      showSubmitSignature: !signed,
      showUnlock: false,
      showPrint: true,
      showQualityCheck: true,
      showConflictAction: true,
      showDeviceControls: false,
      primaryLabel: '待签名',
      primaryDisabled: true,
      primaryType: 'outline',
      primaryAction: 'none',
    };
  }

  const collecting = phase === 'collecting';
  const canEnd = collecting && item?.recordStatus === '采集中' && isRecordReadyToEnd(item).ok;
  return {
    phase,
    showStartRecord: false,
    showEndRecord: canEnd,
    showSaveDraft: true,
    showRescue: true,
    showExitRescue: false,
    showSubmitSignature: false,
    showUnlock: false,
    showPrint: true,
    showQualityCheck: true,
    showConflictAction: true,
    showDeviceControls: true,
    primaryLabel: canEnd ? '结束记录' : item?.recordStatus === '补记中' ? '补记中' : '记录中',
    primaryDisabled: !canEnd,
    primaryType: canEnd ? 'primary' : 'outline',
    primaryAction: canEnd ? 'end' : 'none',
  };
};

export const recordStatusTagMeta = (
  phase: RecordWorkflowPhase,
  item?: RecordActionCase,
): { label: string; color: string } => {
  switch (phase) {
    case 'rescue':
      return { label: '抢救中', color: 'red' };
    case 'locked':
      return { label: '已锁定', color: 'orangered' };
    case 'signed':
      return { label: '已签名', color: 'green' };
    case 'collecting':
      return { label: item?.recordStatus === '补记中' ? '补记中' : '采集中', color: 'green' };
    case 'awaiting_signature':
      return { label: '待签名', color: 'orange' };
    case 'not_started':
      return { label: '未开始', color: 'gray' };
    case 'completed':
      return { label: '已完成', color: 'arcoblue' };
    default:
      return { label: item?.recordStatus ?? '记录中', color: 'arcoblue' };
  }
};
