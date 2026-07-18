import { describe, expect, it } from 'vitest';
import { fromBackendRecordStatus, toBackendDraftRecordStatus } from './recordStatusCodec';

describe('recordStatusCodec', () => {
  it('草稿同步只发送后端稳定状态码，待签名不能绕过 submitRecord', () => {
    expect(toBackendDraftRecordStatus('未开始')).toBe('draft');
    expect(toBackendDraftRecordStatus('采集中')).toBe('recording');
    expect(toBackendDraftRecordStatus('补记中')).toBe('recording');
    expect(toBackendDraftRecordStatus('待签名')).toBe('recording');
    expect(toBackendDraftRecordStatus('已锁定')).toBe('recording');
  });

  it('服务端终态回读为中文界面状态并保留补记语义', () => {
    expect(fromBackendRecordStatus('draft')).toMatchObject({ recordStatus: '未开始' });
    expect(fromBackendRecordStatus('recording', '补记中')).toMatchObject({ recordStatus: '补记中' });
    expect(fromBackendRecordStatus('submitted')).toMatchObject({ recordStatus: '待签名', signatureStatus: '待签名' });
    expect(fromBackendRecordStatus('signed')).toMatchObject({ recordStatus: '已锁定', signatureStatus: '已签名', locked: true });
    expect(fromBackendRecordStatus('archived')).toMatchObject({ recordStatus: '已锁定', signatureStatus: '已签名', locked: true });
  });
});
