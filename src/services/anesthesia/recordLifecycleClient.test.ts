import { describe, expect, it, vi } from 'vitest';
import { signRecordWithProvider, submitRecordForSignature } from './recordLifecycleClient';

describe('recordLifecycleClient', () => {
  it('同步队列清空后调用 submitRecord 并更新本地服务端版本', async () => {
    const putRecord = vi.fn(async () => undefined);
    const submit = vi.fn(async () => ({
      record: {
        operationId: 'OP-1', recordLocalId: 'REC-1', status: 'submitted', syncVersion: 8,
        documentVersion: 2, submittedAt: '2026-07-17 10:00:00', signedAt: null,
        archivedAt: null, contentHash: 'hash-1',
      },
      revision: { revisionId: 'REV-2', version: 2, status: 'submitted' },
    }));
    const result = await submitRecordForSignature('REC-1', {
      casePayload: { id: 'REC-1', recordStatus: '待签名' },
      deps: {
        checkCanSubmit: async () => ({ canSubmit: true, reason: null }),
        getRecord: async () => ({
          local_id: 'REC-1', operation_id: 'OP-1', sync_version: 7,
          record_status: 'recording', case_payload: JSON.stringify({ id: 'REC-1', recordStatus: '采集中' }),
        }),
        putRecord,
        submit,
        nowIso: () => '2026-07-17T10:00:01+08:00',
      },
    });

    expect(submit).toHaveBeenCalledWith({ operationId: 'OP-1', recordLocalId: 'REC-1', expectedSyncVersion: 7 });
    expect(result).toMatchObject({ ok: true, revisionId: 'REV-2', syncVersion: 8, documentVersion: 2 });
    expect(putRecord).toHaveBeenCalledWith(expect.objectContaining({
      record_status: 'submitted', sync_version: 8, sync_status: 'success',
    }));
  });

  it('存在冲突或待同步失败时不调用 submitRecord', async () => {
    const submit = vi.fn();
    const result = await submitRecordForSignature('REC-1', {
      deps: {
        checkCanSubmit: async () => ({ canSubmit: false, reason: '存在同步失败' }),
        getRecord: vi.fn(),
        putRecord: vi.fn(),
        submit,
        nowIso: () => '',
      },
    });
    expect(result).toEqual({ ok: false, message: '存在同步失败' });
    expect(submit).not.toHaveBeenCalled();
  });

  it('缺少第三方签名回执时保持待签名且零后端写入', async () => {
    const sign = vi.fn();
    const result = await signRecordWithProvider('REC-1', {
      revisionId: 'REV-2', providerSignatureId: '', expectedSyncVersion: 8,
    }, {
      getRecord: vi.fn(), putRecord: vi.fn(), sign, nowIso: () => '',
    });
    expect(result).toEqual({ ok: false, message: '第三方电子签名服务尚未返回签名凭据，记录保持待签名。' });
    expect(sign).not.toHaveBeenCalled();
  });

  it('携带冻结版本与第三方签名回执后调用 signRecord 并锁定本地记录', async () => {
    const putRecord = vi.fn(async () => undefined);
    const sign = vi.fn(async () => ({
      operationId: 'OP-1', recordLocalId: 'REC-1', status: 'signed', syncVersion: 9,
      documentVersion: 2, submittedAt: '2026-07-17 10:00:00', signedAt: '2026-07-17 10:02:00',
      archivedAt: null, contentHash: 'hash-1',
    }));
    const result = await signRecordWithProvider('REC-1', {
      revisionId: 'REV-2', providerSignatureId: 'SIGN-PROVIDER-1', expectedSyncVersion: 8,
      casePayload: { id: 'REC-1', recordStatus: '已锁定', locked: true },
    }, {
      getRecord: async () => ({
        local_id: 'REC-1', operation_id: 'OP-1', sync_version: 8,
        record_status: 'submitted', case_payload: '{}',
      }),
      putRecord, sign, nowIso: () => '2026-07-17T10:02:01+08:00',
    });
    expect(sign).toHaveBeenCalledWith({
      operationId: 'OP-1', recordLocalId: 'REC-1', revisionId: 'REV-2',
      providerSignatureId: 'SIGN-PROVIDER-1', expectedSyncVersion: 8,
    });
    expect(result).toMatchObject({ ok: true, syncVersion: 9, signedAt: '2026-07-17 10:02:00' });
    expect(putRecord).toHaveBeenCalledWith(expect.objectContaining({
      record_status: 'signed', record_locked: 1, sync_version: 9, sync_status: 'success',
    }));
  });
});
