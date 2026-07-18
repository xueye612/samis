import type { AnesthesiaRecordSignatureState, SurgeryCase } from '@/types/anesthesia';

export type BackendRecordStatus = 'draft' | 'recording' | 'submitted' | 'signed' | 'archived' | 'locked';

/**
 * 普通草稿同步只能写 draft/recording。
 * submitted/signed/archived 必须通过后端生命周期接口产生，不能靠 saveRecord 越权写入。
 */
export function toBackendDraftRecordStatus(status?: SurgeryCase['recordStatus'] | string | null): 'draft' | 'recording' {
  return !status || status === '未开始' || status === 'draft' ? 'draft' : 'recording';
}

export interface UiRecordStatusProjection {
  recordStatus: NonNullable<SurgeryCase['recordStatus']>;
  signatureStatus?: AnesthesiaRecordSignatureState['status'];
  locked?: boolean;
}

export function fromBackendRecordStatus(
  status?: string | null,
  casePayloadStatus?: string | null,
): UiRecordStatusProjection {
  switch (status) {
    case 'submitted':
      return { recordStatus: '待签名', signatureStatus: '待签名' };
    case 'signed':
    case 'archived':
    case 'locked':
      return { recordStatus: '已锁定', signatureStatus: '已签名', locked: true };
    case 'recording':
      return { recordStatus: casePayloadStatus === '补记中' ? '补记中' : '采集中' };
    case 'draft':
      return { recordStatus: '未开始' };
    default:
      if (status === '待签名' || status === '已完成' || status === '已锁定' || status === '补记中' || status === '采集中' || status === '未开始') {
        return { recordStatus: status };
      }
      return { recordStatus: casePayloadStatus === '补记中' ? '补记中' : '未开始' };
  }
}
