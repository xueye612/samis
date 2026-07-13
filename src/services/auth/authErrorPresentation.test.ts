import { describe, expect, it, vi } from 'vitest';
import { SamisHttpError } from '@/api/samisHttpClient';
import { notifyIfUnhandledSamisError } from '@/services/auth/authErrorPresentation';

describe('notifyIfUnhandledSamisError', () => {
  it('suppresses the local callback for an auth error already handled by the coordinator', () => {
    const notify = vi.fn();
    notifyIfUnhandledSamisError(new SamisHttpError('Token缺失', 400, 9001, true), notify);
    expect(notify).not.toHaveBeenCalled();
  });

  it('keeps local callbacks for non-auth HTTP and ordinary errors', () => {
    const notify = vi.fn();
    notifyIfUnhandledSamisError(new SamisHttpError('服务不可用', 503), notify);
    notifyIfUnhandledSamisError(new Error('解析失败'), notify);
    expect(notify).toHaveBeenCalledTimes(2);
  });
});
