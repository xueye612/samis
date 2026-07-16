import { describe, expect, it, vi } from 'vitest';
import {
  buildMonitoringSessionFromCase,
  getMonitoringRegistry,
  markMockTicking,
  prepareScopeSwitchHint,
  persistMonitoringRegistry,
  resolveMonitoringViewUi,
  saveSession,
  type MonitoringSessionRegistry,
} from './monitoringSessionService';
import type { SurgeryCase } from '@/types/anesthesia';

const localDbMocks = vi.hoisted(() => ({
  put: vi.fn(async (_row: { value: string }) => undefined),
  delete: vi.fn(async (_key: string) => undefined),
}));

vi.mock('@/services/anesthesia/localDb', () => ({
  getAnesthesiaLocalDb: () => ({ settings: localDbMocks }),
}));

const baseCase = (id: string, name: string): SurgeryCase => ({
  id,
  patientId: id,
  patientName: name,
  room: 'OR-01',
  surgeryName: '测试手术',
  locked: false,
} as SurgeryCase);

describe('monitoringSessionService', () => {
  it('切换患者时提示监护仍归属原记录单', () => {
    const session = buildMonitoringSessionFromCase(baseCase('case-a', '张三'));
    session.monitorActive = true;
    const registry: MonitoringSessionRegistry = {
      sessions: { 'case-a': session },
    };
    const hint = prepareScopeSwitchHint('case-a', 'case-b', registry);
    expect(hint.needConfirm).toBe(true);
    expect(hint.message).toContain('不会写入新患者记录单');
  });

  it('查看其他患者时不显示本页设备运行中', () => {
    const session = buildMonitoringSessionFromCase(baseCase('case-a', '张三'));
    session.monitorActive = true;
    session.mockTicking = true;
    const registry: MonitoringSessionRegistry = {
      sessions: { 'case-a': session },
      mockBoundRecordLocalId: 'case-a',
    };
    const ui = resolveMonitoringViewUi('case-b', registry);
    expect(ui.monitorRunning).toBe(false);
    expect(ui.sessionOnOtherCase).toBe(true);
  });

  it('切回原患者可识别暂停会话与恢复提示', () => {
    const session = buildMonitoringSessionFromCase(baseCase('case-a', '张三'));
    session.monitorActive = true;
    session.mockResumePending = true;
    const registry: MonitoringSessionRegistry = {
      sessions: { 'case-a': session },
    };
    const ui = resolveMonitoringViewUi('case-a', registry);
    expect(ui.hasMonitorSession).toBe(true);
    expect(ui.monitoringPaused).toBe(true);
    expect(ui.resumePending).toBe(true);
  });

  it('持久化运行中会话时仅清理落盘副本，不覆盖内存运行态', async () => {
    const session = buildMonitoringSessionFromCase(baseCase('case-persist-running', '李四'));
    session.monitorActive = true;
    saveSession(session);
    markMockTicking(session, true);

    await persistMonitoringRegistry();

    expect(resolveMonitoringViewUi('case-persist-running', getMonitoringRegistry()).monitorRunning).toBe(true);
    const lastPutCall = localDbMocks.put.mock.calls[localDbMocks.put.mock.calls.length - 1];
    const persisted = JSON.parse(String(lastPutCall?.[0]?.value));
    expect(persisted.sessions['case-persist-running'].mockTicking).toBe(false);
  });
});
