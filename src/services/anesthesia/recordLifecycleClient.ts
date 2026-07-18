import dayjs from 'dayjs';
import { recordLifecycleApi, type RecordStatusApi } from '@/api/clinicalExtensions';
import { getAnesthesiaLocalDb } from '@/services/anesthesia/localDb';
import { checkCanSubmitRecord } from '@/services/anesthesia/anesthesiaSyncService';

interface LifecycleRecordRow {
  local_id: string;
  operation_id: string;
  sync_version: number;
  record_status?: string;
  case_payload: string;
  [key: string]: unknown;
}

interface SubmitResponse {
  record: RecordStatusApi;
  revision: unknown;
}

export interface RecordLifecycleClientDeps {
  checkCanSubmit: (recordLocalId: string) => Promise<{ canSubmit: boolean; reason: string | null }>;
  getRecord: (recordLocalId: string) => Promise<LifecycleRecordRow | undefined>;
  putRecord: (row: LifecycleRecordRow) => Promise<unknown>;
  submit: (data: { operationId: string; recordLocalId: string; expectedSyncVersion: number }) => Promise<SubmitResponse>;
  nowIso: () => string;
}

export type SubmitRecordLifecycleResult =
  | { ok: true; revisionId: string; syncVersion: number; documentVersion: number; submittedAt: string | null }
  | { ok: false; message: string; conflict?: boolean };

export interface SignRecordLifecycleDeps {
  getRecord: (recordLocalId: string) => Promise<LifecycleRecordRow | undefined>;
  putRecord: (row: LifecycleRecordRow) => Promise<unknown>;
  sign: (data: {
    operationId: string;
    recordLocalId: string;
    revisionId: string;
    providerSignatureId: string;
    expectedSyncVersion: number;
  }) => Promise<RecordStatusApi>;
  nowIso: () => string;
}

export type SignRecordLifecycleResult =
  | { ok: true; syncVersion: number; signedAt: string | null }
  | { ok: false; message: string; conflict?: boolean };

const defaultDeps = (): RecordLifecycleClientDeps => {
  const db = getAnesthesiaLocalDb();
  return {
    checkCanSubmit: checkCanSubmitRecord,
    getRecord: (recordLocalId) => db.records.get(recordLocalId) as Promise<LifecycleRecordRow | undefined>,
    putRecord: (row) => db.records.put(row as never),
    submit: (data) => recordLifecycleApi.submit(data),
    nowIso: () => dayjs().toISOString(),
  };
};

const defaultSignDeps = (): SignRecordLifecycleDeps => {
  const db = getAnesthesiaLocalDb();
  return {
    getRecord: (recordLocalId) => db.records.get(recordLocalId) as Promise<LifecycleRecordRow | undefined>,
    putRecord: (row) => db.records.put(row as never),
    sign: (data) => recordLifecycleApi.sign(data),
    nowIso: () => dayjs().toISOString(),
  };
};

const revisionIdFrom = (revision: unknown): string => {
  if (!revision || typeof revision !== 'object') return '';
  const value = (revision as { revisionId?: unknown }).revisionId;
  return value === undefined || value === null ? '' : String(value);
};

export async function submitRecordForSignature(
  recordLocalId: string,
  options: { casePayload?: unknown; deps?: RecordLifecycleClientDeps } = {},
): Promise<SubmitRecordLifecycleResult> {
  const deps = options.deps ?? defaultDeps();
  const gate = await deps.checkCanSubmit(recordLocalId);
  if (!gate.canSubmit) return { ok: false, message: gate.reason ?? '记录尚未完成同步，不能结束。' };

  const local = await deps.getRecord(recordLocalId);
  if (!local) return { ok: false, message: '本地麻醉记录不存在，不能提交。' };
  if (!local.operation_id || !local.local_id || local.sync_version <= 0) {
    return { ok: false, message: '麻醉记录同步版本无效，请重新读取后再试。' };
  }

  try {
    const response = await deps.submit({
      operationId: local.operation_id,
      recordLocalId: local.local_id,
      expectedSyncVersion: local.sync_version,
    });
    if (response.record.status !== 'submitted') {
      return { ok: false, message: `服务端返回了非待签名状态：${response.record.status || '未知'}` };
    }
    const revisionId = revisionIdFrom(response.revision);
    if (!revisionId) return { ok: false, message: '服务端未返回冻结版本，记录不能进入待签名。' };

    await deps.putRecord({
      ...local,
      record_status: 'submitted',
      case_payload: options.casePayload ? JSON.stringify(options.casePayload) : local.case_payload,
      sync_version: response.record.syncVersion,
      sync_status: 'success',
      updated_at: deps.nowIso(),
      last_synced_at: deps.nowIso(),
    });
    return {
      ok: true,
      revisionId,
      syncVersion: response.record.syncVersion,
      documentVersion: response.record.documentVersion,
      submittedAt: response.record.submittedAt,
    };
  } catch (error) {
    const code = Number((error as { code?: unknown })?.code ?? 0);
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: message || '提交待签名状态失败。', conflict: code === 4091 };
  }
}

/**
 * 第三方电子签名回执写入边界。
 * 没有 providerSignatureId 时绝不以本地姓名或按钮点击伪造“已签名”。
 */
export async function signRecordWithProvider(
  recordLocalId: string,
  options: {
    revisionId: string;
    providerSignatureId: string;
    expectedSyncVersion: number;
    casePayload?: unknown;
  },
  deps: SignRecordLifecycleDeps = defaultSignDeps(),
): Promise<SignRecordLifecycleResult> {
  if (!options.providerSignatureId.trim()) {
    return { ok: false, message: '第三方电子签名服务尚未返回签名凭据，记录保持待签名。' };
  }
  if (!options.revisionId.trim() || options.expectedSyncVersion <= 0) {
    return { ok: false, message: '待签名版本信息不完整，请重新读取记录。' };
  }
  const local = await deps.getRecord(recordLocalId);
  if (!local) return { ok: false, message: '本地麻醉记录不存在，不能签名。' };
  if (local.record_status !== 'submitted' || local.sync_version !== options.expectedSyncVersion) {
    return { ok: false, message: '待签名记录版本已变化，请重新读取后再签名。', conflict: true };
  }

  try {
    const response = await deps.sign({
      operationId: local.operation_id,
      recordLocalId: local.local_id,
      revisionId: options.revisionId,
      providerSignatureId: options.providerSignatureId,
      expectedSyncVersion: options.expectedSyncVersion,
    });
    if (response.status !== 'signed') {
      return { ok: false, message: `服务端返回了非已签名状态：${response.status || '未知'}` };
    }
    const now = deps.nowIso();
    await deps.putRecord({
      ...local,
      record_status: 'signed',
      record_locked: 1,
      case_payload: options.casePayload ? JSON.stringify(options.casePayload) : local.case_payload,
      sync_version: response.syncVersion,
      sync_status: 'success',
      updated_at: now,
      last_synced_at: now,
    });
    return { ok: true, syncVersion: response.syncVersion, signedAt: response.signedAt };
  } catch (error) {
    const code = Number((error as { code?: unknown })?.code ?? 0);
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: message || '第三方签名提交失败。', conflict: code === 4091 };
  }
}
