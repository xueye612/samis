import type { SurgeryCase } from '@/types/anesthesia';

export type RecordActionCase = Pick<
  SurgeryCase,
  | 'anesthesiaStart'
  | 'recordStatus'
  | 'locked'
  | 'signatures'
>;

export type RecordWorkflowPhase =
  | 'not_started'
  | 'recording'
  | 'collecting'
  | 'locked'
  | 'signed'
  | 'rescue';

export interface RecordActionVisibility {
  phase: RecordWorkflowPhase;
  showStartRecord: boolean;
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
  primaryAction: 'start' | 'none';
}

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
  if (actions.phase === 'not_started') {
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
      showSaveDraft: true,
      showRescue: false,
      showExitRescue: !locked,
      showSubmitSignature: !locked && !signed,
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

  const collecting = phase === 'collecting';
  return {
    phase,
    showStartRecord: false,
    showSaveDraft: true,
    showRescue: true,
    showExitRescue: false,
    showSubmitSignature: !signed,
    showUnlock: false,
    showPrint: true,
    showQualityCheck: true,
    showConflictAction: true,
    showDeviceControls: true,
    primaryLabel: collecting ? '采集中' : '记录中',
    primaryDisabled: true,
    primaryType: 'outline',
    primaryAction: 'none',
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
    case 'not_started':
      return { label: '未开始', color: 'gray' };
    default:
      return { label: item?.recordStatus ?? '记录中', color: 'arcoblue' };
  }
};
