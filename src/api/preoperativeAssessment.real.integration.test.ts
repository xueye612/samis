/**
 * 术前麻醉评估真实联调。默认全部 skipped，不登录、不访问数据库。
 *
 * 当前阶段没有评估持久化表：opt-in 只验证真实 OperationCase detail 与写接口明确阻塞，
 * 不会借用其他 anes_preop_* 表写入。
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { preoperativeApi } from '@/api/preoperative';
import { setSamisSession } from '@/services/session/samisSession';

if (typeof globalThis.sessionStorage === 'undefined') {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() { return store.size; },
    },
    configurable: true,
  });
}

const processEnv = ((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {});
const env = { ...processEnv, ...import.meta.env } as Record<string, string | undefined>;
const OPERATION_ID = env.SAMIS_PREOP_OPERATION_ID || env.SAMIS_E2E_SCHEDULE_OPERATION_ID || '';
const ALLOWED_ID = /^OP-E2E-(?:PREOP|SCHEDULE|NATURAL)-/.test(OPERATION_ID);
const SHOULD_RUN = (env.SAMIS_PREOP_REAL_INTEGRATION === '1' || env.VITE_SAMIS_PREOP_REAL_INTEGRATION === '1')
  && env.VITE_USE_REAL_PREOPERATIVE === 'true'
  && ALLOWED_ID;
const API_BASE = (env.VITE_SAMIS_API_BASE || 'http://192.168.10.178:8022/api-samis/pc/v1').replace(/\/+$/, '');
const USERNAME = env.SAMIS_REAL_USERNAME || 'quality_admin';
const PASSWORD = env.SAMIS_REAL_PASSWORD || 'samis2026';

async function login(): Promise<void> {
  const response = await fetch(`${API_BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: USERNAME, password: PASSWORD }),
  });
  const json = await response.json() as { code: number; message?: string; data?: { token?: string; userInfo?: { token?: string } } };
  expect(json.code, json.message).toBe(0);
  const token = json.data?.token || json.data?.userInfo?.token;
  expect(token).toEqual(expect.any(String));
  setSamisSession({ token });
}

describe.runIf(SHOULD_RUN)('preoperative assessment real integration', () => {
  beforeAll(login);

  it('reads OperationCase from the real operation notice and reports persistence capability', async () => {
    const detail = await preoperativeApi.assessmentDetail(OPERATION_ID);
    expect(detail.operationCase).toEqual(expect.objectContaining({ operationId: OPERATION_ID }));
    expect(detail.operationCase.patientName).toEqual(expect.any(String));
    expect(detail.operationCase.operationName).toEqual(expect.any(String));
    expect(detail.assessment).toBeNull();
    expect(detail.persistence).toEqual({
      available: false,
      reason: 'assessment_storage_not_configured',
    });
  });

  it('refuses real writes while assessment storage is unavailable', async () => {
    await expect(preoperativeApi.assessmentSaveDraft({
      operationId: OPERATION_ID,
      asaGrade: 'II',
      anesthesiaPlan: 'OP-E2E-PREOP 联调计划',
      airwayAssessment: null,
      allergyHistory: null,
      pastAnesthesiaHistory: null,
      abnormalExamSummary: null,
      riskSummary: null,
      preMedicationAdvice: null,
      evaluatorId: 'quality_admin',
      evaluatorName: '联调账号',
      evaluatedAt: null,
    })).rejects.toThrow('术前麻醉评估存储未配置');
  });
});
