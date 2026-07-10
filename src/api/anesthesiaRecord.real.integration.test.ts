/**
 * 麻醉记录真实链路联调：默认跳过，显式 opt-in 后才访问真实后端。
 *
 * 默认运行：
 *   npm test -- src/api/anesthesiaRecord.real.integration.test.ts
 *
 * 真实运行：
 *   VITE_SAMIS_REAL_INTEGRATION=1 \
 *   VITE_USE_REAL_ANESTHESIA_RECORD=true \
 *   VITE_USE_REAL_ANESTHESIA_SYNC=true \
 *   VITE_SAMIS_API_BASE=http://192.168.10.178:8022/api-samis/pc/v1 \
 *   npm test -- src/api/anesthesiaRecord.real.integration.test.ts
 */
import { describe, expect, it } from 'vitest';
import {
  anesthesiaRecordApi,
  anesthesiaSyncApi,
  type PushBatchRequest,
  type PushBatchResultItem,
} from '@/api/anesthesiaSync';
import { operationInfoApi } from '@/api/operationInfo';
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
      get length() {
        return store.size;
      },
    },
    configurable: true,
  });
}

const processEnv = ((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {});
const env = {
  ...processEnv,
  ...import.meta.env,
} as Record<string, string | undefined>;

const REAL_INTEGRATION = env.VITE_SAMIS_REAL_INTEGRATION === '1' || env.SAMIS_REAL_INTEGRATION === '1';
const REAL_RECORD = env.VITE_USE_REAL_ANESTHESIA_RECORD === 'true';
const REAL_SYNC = env.VITE_USE_REAL_ANESTHESIA_SYNC === 'true';
const SHOULD_RUN_REAL = REAL_INTEGRATION && REAL_RECORD && REAL_SYNC;
const SCHEDULE_OPERATION_ID = env.SAMIS_E2E_SCHEDULE_OPERATION_ID || '';
const SHOULD_VERIFY_SCHEDULE = SHOULD_RUN_REAL && /^OP-E2E-(?:SCHEDULE|NATURAL)-/.test(SCHEDULE_OPERATION_ID);

const API_BASE = (env.VITE_SAMIS_API_BASE || 'http://192.168.10.178:8022/api-samis/pc/v1').replace(/\/+$/, '');
const USERNAME = env.SAMIS_REAL_USERNAME || env.VITE_SAMIS_REAL_USERNAME || 'quality_admin';
const PASSWORD = env.SAMIS_REAL_PASSWORD || env.VITE_SAMIS_REAL_PASSWORD || 'samis2026';

interface LoginResponse {
  code: number;
  message?: string;
  data?: {
    token?: string;
    userInfo?: {
      token?: string;
    };
  };
}

function timestampId(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
    String(now.getMilliseconds()).padStart(3, '0'),
  ].join('');
}

function createRealSyncIds(suffix = timestampId()) {
  const operationId = `OP-E2E-REAL-SYNC-${suffix}`;
  return {
    operationId,
    recordLocalId: `rec-e2e-real-sync-${suffix}`,
    batchNo: `anes-real-sync-${suffix}`,
  };
}

const realSyncIds = createRealSyncIds();

async function loginAndSeedSession(): Promise<string> {
  const response = await fetch(`${API_BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: USERNAME, password: PASSWORD }),
  });
  const json = (await response.json()) as LoginResponse;
  expect(json.code, json.message).toBe(0);
  const token = json.data?.token || json.data?.userInfo?.token;
  expect(typeof token).toBe('string');
  expect(token?.length).toBeGreaterThan(20);
  setSamisSession({ token });
  return token as string;
}

function buildPushBatchRequest(): PushBatchRequest {
  const { operationId, recordLocalId, batchNo } = realSyncIds;
  const eventTime = '2026-07-09 15:10:00';
  return {
    batchNo,
    operationId,
    recordLocalId,
    clientTime: new Date().toISOString(),
    items: [
      {
        entityType: 'record',
        operationType: 'create',
        localId: recordLocalId,
        baseSyncVersion: 0,
        apiPath: '/api-samis/pc/v1/anesthesiaSync/pushBatch',
        payload: {
          recordNo: `ANES-${operationId}`,
          patientId: 'P-E2E-REAL-SYNC',
          operationRoomId: 'OR-E2E',
          recordStatus: 'recording',
          recordStartTime: eventTime,
          anesthesiaMethod: 'E2E全麻',
          asaLevel: 'II',
          pageCount: 1,
          currentPage: 1,
          casePayload: {
            patient: {
              id: 'P-E2E-REAL-SYNC',
              name: 'E2E麻醉记录联调',
            },
            operation: {
              operationId,
              name: 'E2E真实链路测试手术',
            },
          },
        },
      },
      {
        entityType: 'timeline_event',
        operationType: 'create',
        localId: `timeline-e2e-${operationId}`,
        baseSyncVersion: 0,
        apiPath: '/api-samis/pc/v1/anesthesiaSync/pushBatch',
        payload: {
          eventType: '入室',
          eventCode: 'E2E_ROOM_IN',
          eventName: 'E2E患者入室',
          eventTime,
          stage: 'induction',
          severity: 'info',
          source: 'real-integration',
          status: 'active',
        },
      },
      {
        entityType: 'medication',
        operationType: 'create',
        localId: `med-e2e-${operationId}`,
        baseSyncVersion: 0,
        apiPath: '/api-samis/pc/v1/anesthesiaSync/pushBatch',
        payload: {
          drugName: 'E2E_TEST_丙泊酚',
          drugCode: 'E2E_PROPOFOL',
          drugCategory: 'anesthetic',
          dose: '100',
          doseUnit: 'mg',
          route: 'iv',
          mode: 'bolus',
          eventTime,
          displayText: 'E2E_TEST_丙泊酚 100mg',
          executor: 'quality_admin',
          source: 'real-integration',
          status: 'active',
        },
      },
      {
        entityType: 'vital_sign',
        operationType: 'create',
        localId: `vital-e2e-${operationId}`,
        baseSyncVersion: 0,
        apiPath: '/api-samis/pc/v1/anesthesiaSync/pushBatch',
        payload: {
          measureTime: eventTime,
          HR: 80,
          SBP: 120,
          DBP: 70,
          SpO2: 99,
          source: 'manual',
          isDisplayPoint: true,
          displayRow: 1,
        },
      },
    ],
  };
}

function expectedChildLocalIds() {
  const { operationId } = realSyncIds;
  return {
    timelineEventLocalId: `timeline-e2e-${operationId}`,
    medicationLocalId: `med-e2e-${operationId}`,
    vitalSignLocalId: `vital-e2e-${operationId}`,
  };
}

function summarizePushResults(batchNo: string, results: PushBatchResultItem[]): string {
  return results
    .map((item) => JSON.stringify({
      batchNo,
      entityType: item.entityType,
      localId: item.localId,
      status: item.status,
      code: item.conflictType,
      result: item.message,
    }))
    .join('\n');
}

interface RealRecordDetail {
  operationId: string;
  record: null | {
    operationId?: string;
    localId?: string;
    recordLocalId?: string;
    casePayload?: unknown;
    timelineEvents?: Array<{ localId?: string; eventType?: string; eventName?: string }>;
    medications?: Array<{ localId?: string; drugName?: string; dose?: string | number; doseUnit?: string }>;
    vitalSigns?: Array<Record<string, unknown> & { localId?: string }>;
    fluids?: unknown[];
    transfusions?: unknown[];
    ioRecords?: unknown[];
    labResults?: unknown[];
  };
}

function isRecordCleared(detail: RealRecordDetail): boolean {
  return detail.record === null || detail.record === undefined;
}

function expectHydratedRecord(detail: RealRecordDetail): void {
  const childIds = expectedChildLocalIds();
  expect(detail.operationId).toBe(realSyncIds.operationId);
  expect(detail.record).not.toBeNull();
  const record = detail.record!;

  expect(record.localId || record.recordLocalId).toBe(realSyncIds.recordLocalId);
  expect(record.casePayload).toBeTruthy();
  expect(Array.isArray(record.timelineEvents)).toBe(true);
  expect(Array.isArray(record.medications)).toBe(true);
  expect(Array.isArray(record.vitalSigns)).toBe(true);
  expect(Array.isArray(record.fluids)).toBe(true);
  expect(Array.isArray(record.transfusions)).toBe(true);
  expect(Array.isArray(record.ioRecords)).toBe(true);
  expect(Array.isArray(record.labResults)).toBe(true);

  expect(record.timelineEvents?.some((item) => item.localId === childIds.timelineEventLocalId)).toBe(true);
  expect(record.medications?.some((item) => item.localId === childIds.medicationLocalId)).toBe(true);
  expect(record.vitalSigns?.some((item) => item.localId === childIds.vitalSignLocalId)).toBe(true);
}

describe.skipIf(!SHOULD_RUN_REAL)('anesthesia record real sync integration', () => {
  it('logs in and prepares OP-E2E-REAL-SYNC identifiers without writing data', async () => {
    const token = await loginAndSeedSession();

    expect(token).toBeTruthy();
    expect(realSyncIds.operationId).toMatch(/^OP-E2E-REAL-SYNC-\d{17}$/);
    expect(realSyncIds.recordLocalId).toBe(realSyncIds.operationId.replace('OP-E2E-REAL-SYNC-', 'rec-e2e-real-sync-'));
    expect(realSyncIds.batchNo).toBe(realSyncIds.operationId.replace('OP-E2E-REAL-SYNC-', 'anes-real-sync-'));
  });

  it('pushes record, timeline_event, medication, and vital_sign through pushBatch', async () => {
    await loginAndSeedSession();
    const request = buildPushBatchRequest();
    const response = await anesthesiaSyncApi.pushBatch(request);
    const summary = summarizePushResults(response.batchNo, response.results);

    expect(response.batchNo).toBe(request.batchNo);
    expect(response.results).toHaveLength(4);
    expect(response.results.map((item) => item.entityType)).toEqual([
      'record',
      'timeline_event',
      'medication',
      'vital_sign',
    ]);
    expect(response.results.every((item) => item.status === 'success'), summary).toBe(true);
  });

  it('reads pushed record detail and voids the synthetic test record', async () => {
    await loginAndSeedSession();
    let readbackFailure: unknown;

    try {
      const detail = await anesthesiaRecordApi.getRecordDetail({
        operationId: realSyncIds.operationId,
      }) as RealRecordDetail;
      expectHydratedRecord(detail);
    } catch (error) {
      readbackFailure = error;
    }

    const voided = await anesthesiaRecordApi.voidRecord({
      operationId: realSyncIds.operationId,
      recordLocalId: realSyncIds.recordLocalId,
      voidReason: 'real sync integration cleanup',
    }) as { voided: boolean; voidedAt?: string };
    expect(voided.voided).toBe(true);

    const afterCleanup = await anesthesiaRecordApi.getRecordDetail({
      operationId: realSyncIds.operationId,
    }) as RealRecordDetail;
    expect(isRecordCleared(afterCleanup)).toBe(true);

    if (readbackFailure) throw readbackFailure;
  });
});

describe.skipIf(!SHOULD_VERIFY_SCHEDULE)('operationInfo natural schedule integration', () => {
  it('returns the synthetic schedule through the authenticated real operation list contracts', async () => {
    await loginAndSeedSession();
    const raw = await operationInfoApi.getOperationList({
      operationDate: new Date().toISOString().slice(0, 10),
    }) as { list?: Array<Record<string, unknown>> };
    const row = raw.list?.find((item) => item.OPERATIONID === SCHEDULE_OPERATION_ID);

    expect(row, `missing ${SCHEDULE_OPERATION_ID} from real operationInfo list`).toBeTruthy();
    expect(row?.OPERATIONID).toBe(SCHEDULE_OPERATION_ID);
    expect(row?.PATIENT_NAME).toMatch(/^OP-E2E-SCHEDULE-/);
    expect(row?.operationCase).toMatchObject({ operationId: SCHEDULE_OPERATION_ID });
    expect(row?.operationTimeline).toEqual(expect.objectContaining({
      inRoomTime: null,
      anesthesiaStartTime: null,
      operationStartTime: null,
      operationEndTime: null,
      outRoomTime: null,
    }));
  });
});
