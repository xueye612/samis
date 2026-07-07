/**
 * Slice 3a — 真实联调集成测试（anesthesiaRecord 4 接口 vs 后端）。
 *
 * 默认**跳过**：仅在显式设置环境变量 `VITE_SAMIS_REAL_INTEGRATION=1`
 * 且 `VITE_USE_REAL_ANESTHESIA_RECORD=true` 时运行，避免污染常规 `npm test`（mock）。
 *
 * 运行方式（独立隔离，不影响其它 mock 用例）：
 *   VITE_SAMIS_REAL_INTEGRATION=1 \
 *   VITE_USE_REAL_ANESTHESIA_RECORD=true \
 *   VITE_SAMIS_API_BASE=http://47.105.38.226:8022/api-samis/pc/v1 \
 *   vitest run src/api/anesthesiaRecord.real.integration.test.ts
 *
 * 凭据来自环境 SAMIS_REAL_USERNAME / SAMIS_REAL_PASSWORD（默认 quality_admin / samis2026）。
 */
import { describe, expect, it } from 'vitest';

// vitest environment is 'node'; provide a sessionStorage shim so samisSession can persist the token.
if (typeof globalThis.sessionStorage === 'undefined') {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    },
    configurable: true,
  });
}

import { anesthesiaRecordApi } from '@/api/anesthesiaSync';
import { setSamisSession } from '@/services/session/samisSession';

const REAL = import.meta.env.VITE_SAMIS_REAL_INTEGRATION === '1'
  && import.meta.env.VITE_USE_REAL_ANESTHESIA_RECORD === 'true';

const API_BASE = (import.meta.env.VITE_SAMIS_API_BASE as string | undefined)?.replace(/\/+$/, '')
  || '/api-samis/pc/v1';
const SAMIS_HOST = import.meta.env.VITE_SAMIS_REAL_HOST as string | undefined
  || API_BASE.replace(/\/api-samis\/pc\/v1.*$/, '');

const USERNAME = (import.meta.env.SAMIS_REAL_USERNAME as string | undefined) || 'quality_admin';
const PASSWORD = (import.meta.env.SAMIS_REAL_PASSWORD as string | undefined) || 'samis2026';

async function loginAndSeed(): Promise<void> {
  const body = new URLSearchParams({ username: USERNAME, password: PASSWORD });
  const res = await fetch(`${API_BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = (await res.json()) as { code: number; data?: { userInfo?: { token?: string } } };
  expect(json.code).toBe(0);
  const token = json.data?.userInfo?.token;
  expect(typeof token).toBe('string');
  setSamisSession({ token: token as string });
}

describe.skipIf(!REAL)('anesthesiaRecord real integration (Slice 3a)', () => {
  const operationId = `OP-INTEG-${Date.now()}`;
  const localId = `rec-integ-${Date.now()}`;

  it('login seeds token session', async () => {
    await loginAndSeed();
  });

  it('getRecordDetail returns record:null when absent', async () => {
    await loginAndSeed();
    const data = await anesthesiaRecordApi.getRecordDetail({ operationId }) as { operationId: string; record: unknown };
    expect(data.operationId).toBe(operationId);
    expect(data.record).toBeNull();
  });

  it('saveRecord creates and returns serverId; repeat is idempotent', async () => {
    await loginAndSeed();
    const created = await anesthesiaRecordApi.saveRecord({
      operationId,
      localId,
      recordStatus: 'recording',
      pageCount: 1,
      currentPage: 1,
      anesthesiaMethod: '全麻',
      asaLevel: 'II',
      patientId: 'P-INTEG',
    }) as { localId: string; serverId?: number };
    expect(created.localId).toBe(localId);
    expect(created.serverId).toBeTruthy();

    const repeated = await anesthesiaRecordApi.saveRecord({
      operationId,
      localId,
      recordStatus: 'recording',
      pageCount: 1,
      currentPage: 1,
    }) as { serverId?: number };
    expect(repeated.serverId).toBe(created.serverId);
  });

  it('getRecordDetail reflects saved record', async () => {
    await loginAndSeed();
    const data = await anesthesiaRecordApi.getRecordDetail({ operationId }) as {
      record: {
        recordStatus: string;
        recordLocked: boolean;
        anesthesiaMethod: string;
        // Slice 3f 聚合字段
        casePayload: unknown;
        medications: unknown[];
        timelineEvents: unknown[];
        vitalSigns: unknown[];
        fluids: unknown[];
        transfusions: unknown[];
        ioRecords: unknown[];
        labResults: unknown[];
      } | null;
    };
    expect(data.record).not.toBeNull();
    expect(data.record!.recordStatus).toBe('recording');
    expect(data.record!.anesthesiaMethod).toBe('全麻');
    // Slice 3f：聚合回读结构必须存在（空手术为空数组）
    expect(Array.isArray(data.record!.medications)).toBe(true);
    expect(Array.isArray(data.record!.timelineEvents)).toBe(true);
    expect(Array.isArray(data.record!.vitalSigns)).toBe(true);
    expect(Array.isArray(data.record!.fluids)).toBe(true);
    expect(Array.isArray(data.record!.transfusions)).toBe(true);
    expect(Array.isArray(data.record!.ioRecords)).toBe(true);
    expect(Array.isArray(data.record!.labResults)).toBe(true);
    // casePayload 在未写入时为 null（saveRecord 未带 casePayload）
    expect('casePayload' in data.record!).toBe(true);
  });

  it('lockRecord then getRecordDetail shows locked', async () => {
    await loginAndSeed();
    const locked = await anesthesiaRecordApi.lockRecord({ operationId, recordLocalId: localId }) as {
      locked: boolean; lockedAt?: string;
    };
    expect(locked.locked).toBe(true);
    expect(locked.lockedAt).toBeTruthy();

    const data = await anesthesiaRecordApi.getRecordDetail({ operationId }) as {
      record: { recordLocked: boolean; recordStatus: string } | null;
    };
    expect(data.record!.recordLocked).toBe(true);
    expect(data.record!.recordStatus).toBe('locked');
  });

  it('voidRecord soft-deletes; getRecordDetail returns null', async () => {
    await loginAndSeed();
    const voided = await anesthesiaRecordApi.voidRecord({
      operationId,
      recordLocalId: localId,
      voidReason: '集成测试作废',
    }) as { voided: boolean; voidedAt?: string };
    expect(voided.voided).toBe(true);

    const data = await anesthesiaRecordApi.getRecordDetail({ operationId }) as { record: unknown };
    expect(data.record).toBeNull();
  });
});

void SAMIS_HOST;
