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

const env = {
  ...process.env,
  ...import.meta.env,
} as Record<string, string | undefined>;

const REAL_INTEGRATION = env.VITE_SAMIS_REAL_INTEGRATION === '1' || env.SAMIS_REAL_INTEGRATION === '1';
const REAL_RECORD = env.VITE_USE_REAL_ANESTHESIA_RECORD === 'true';
const REAL_SYNC = env.VITE_USE_REAL_ANESTHESIA_SYNC === 'true';
const SHOULD_RUN_REAL = REAL_INTEGRATION && REAL_RECORD && REAL_SYNC;

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

describe.skipIf(!SHOULD_RUN_REAL)('anesthesia record real sync integration', () => {
  it('logs in and prepares OP-E2E-REAL-SYNC identifiers without writing data', async () => {
    const token = await loginAndSeedSession();
    const ids = createRealSyncIds('20260709150000');

    expect(token).toBeTruthy();
    expect(ids.operationId).toMatch(/^OP-E2E-REAL-SYNC-\d{14}$/);
    expect(ids.recordLocalId).toBe('rec-e2e-real-sync-20260709150000');
    expect(ids.batchNo).toBe('anes-real-sync-20260709150000');
  });
});
