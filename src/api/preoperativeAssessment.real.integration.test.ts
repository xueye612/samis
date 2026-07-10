/** 术前麻醉评估真实 API 闭环。默认 skipped，不登录、不写库。 */
// @ts-expect-error Test-only Node API; this DOM project intentionally does not install global Node typings.
import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { preoperativeApi, type PreoperativeAssessmentDraftPayload } from '@/api/preoperative';
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
const PHP_CONTAINER = env.SAMIS_PHP_CONTAINER || '1Panel-php8-B01L';
const PHP_WORKDIR = env.SAMIS_PHP_WORKDIR || '/www/sites/api.cnwenhui.cn/index';

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

function runProtectedPhp(script: string, ...args: string[]): string {
  return execFileSync('docker', [
    'exec', '-e', 'SAMIS_PREOP_REAL_INTEGRATION=1',
    '-e', 'SAMIS_E2E_SCHEDULE_FIXTURE=1',
    '-w', PHP_WORKDIR, PHP_CONTAINER, 'php', script, ...args,
  ], { encoding: 'utf8' }).trim();
}

describe.runIf(SHOULD_RUN)('preoperative assessment real integration', () => {
  beforeAll(login);

  afterAll(() => {
    runProtectedPhp('tests/preoperative_assessment_cleanup.php', OPERATION_ID);
    runProtectedPhp('tests/operation_schedule_fixture.php', 'cleanup', OPERATION_ID);
  });

  it('saves, reads, submits, cancels and reads back without patient master data', async () => {
    const initial = await preoperativeApi.assessmentDetail(OPERATION_ID);
    expect(initial.operationCase).toEqual(expect.objectContaining({ operationId: OPERATION_ID }));
    expect(initial.assessment).toBeNull();
    expect(initial.persistence).toEqual({ available: true, reason: null });

    const payload: PreoperativeAssessmentDraftPayload = {
      operationId: OPERATION_ID,
      asaGrade: 'II',
      anesthesiaPlan: 'OP-E2E-PREOP 前端真实联调计划',
      airwayAssessment: 'Mallampati II',
      allergyHistory: '无',
      pastAnesthesiaHistory: '无异常',
      abnormalExamSummary: '无',
      riskSummary: 'OP-E2E-PREOP 前端联调风险',
      preMedicationAdvice: '禁食禁饮',
      evaluatorId: 'quality_admin',
      evaluatorName: '联调账号',
      evaluatedAt: '2026-07-10 19:10:00',
    };
    expect(Object.keys(payload)).not.toEqual(expect.arrayContaining([
      'patientName', 'patientId', 'patientNo', 'departmentName',
      'operationName', 'operationDate', 'roomName', 'surgeonName',
    ]));

    expect((await preoperativeApi.assessmentSaveDraft(payload)).status).toBe('draft');
    expect((await preoperativeApi.assessmentDetail(OPERATION_ID)).assessment).toEqual(expect.objectContaining({
      status: 'draft', asaGrade: 'II', anesthesiaPlan: payload.anesthesiaPlan,
    }));
    expect((await preoperativeApi.assessmentSubmit(OPERATION_ID)).status).toBe('submitted');
    const submitted = (await preoperativeApi.assessmentDetail(OPERATION_ID)).assessment;
    expect(submitted).toEqual(expect.objectContaining({ status: 'submitted' }));
    expect(submitted?.submittedAt).toEqual(expect.any(String));
    expect((await preoperativeApi.assessmentCancelSubmit(OPERATION_ID)).status).toBe('draft');
    expect((await preoperativeApi.assessmentDetail(OPERATION_ID)).assessment).toEqual(expect.objectContaining({
      status: 'draft', submittedAt: null,
    }));
  });
});
