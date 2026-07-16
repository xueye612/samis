import dayjs from 'dayjs';
import type { SurgeryCase } from '@/types/anesthesia';
import { getAnesthesiaLocalDb } from '@/services/anesthesia/localDb';

export const MONITORING_SESSION_SETTINGS_KEY = 'monitoring_session_v1';

/** 离开绑定患者后 mock 无人值守最长时长（超时停止模拟 tick，会话仍归属原记录单） */
export const MONITORING_MOCK_AWAY_TIMEOUT_MS = 30 * 60 * 1000;

export type MonitoringSessionStatus = 'active' | 'paused' | 'stopped' | 'revoked';

export interface MonitoringSession {
  sessionId: string;
  recordLocalId: string;
  patientId: string;
  patientName: string;
  surgeryName: string;
  room: string;
  operationId: string;
  status: MonitoringSessionStatus;
  monitorActive: boolean;
  ventilatorActive: boolean;
  mockTicking: boolean;
  mockResumePending: boolean;
  startedAt: string;
  stoppedAt?: string;
  revokeReason?: string;
  lastCollectTime?: string;
  displayIntervalMinutes?: number;
}

export interface MonitoringSessionRegistry {
  sessions: Record<string, MonitoringSession>;
  /** 当前 mock 定时器绑定的记录单（仅一条） */
  mockBoundRecordLocalId?: string;
}

export interface MonitoringViewUi {
  monitorRunning: boolean;
  ventilatorRunning: boolean;
  mockTicking: boolean;
  sessionOnOtherCase: boolean;
  sessionOwnerLabel?: string;
  monitoringPaused: boolean;
  resumePending: boolean;
  hasMonitorSession: boolean;
  hasVentilatorSession: boolean;
}

export interface ScopeSwitchHint {
  needConfirm: boolean;
  message?: string;
}

let memoryRegistry: MonitoringSessionRegistry = { sessions: {} };
let awayTimeoutId: ReturnType<typeof setTimeout> | undefined;

export function getMonitoringRegistry(): MonitoringSessionRegistry {
  return memoryRegistry;
}

export function getMonitoringSession(recordLocalId?: string): MonitoringSession | null {
  if (recordLocalId) return memoryRegistry.sessions[recordLocalId] ?? null;
  const boundId = memoryRegistry.mockBoundRecordLocalId;
  return boundId ? memoryRegistry.sessions[boundId] ?? null : null;
}

export function getActiveMockSession(): MonitoringSession | null {
  const boundId = memoryRegistry.mockBoundRecordLocalId;
  if (!boundId) return null;
  return memoryRegistry.sessions[boundId] ?? null;
}

function upsertSession(session: MonitoringSession) {
  memoryRegistry = {
    ...memoryRegistry,
    sessions: {
      ...memoryRegistry.sessions,
      [session.recordLocalId]: session,
    },
  };
}

function removeSession(recordLocalId: string) {
  const { [recordLocalId]: _, ...rest } = memoryRegistry.sessions;
  memoryRegistry = {
    sessions: rest,
    mockBoundRecordLocalId: memoryRegistry.mockBoundRecordLocalId === recordLocalId
      ? undefined
      : memoryRegistry.mockBoundRecordLocalId,
  };
}

export async function loadMonitoringSessionFromDb(): Promise<MonitoringSessionRegistry> {
  const db = getAnesthesiaLocalDb();
  const row = await db.settings.get(MONITORING_SESSION_SETTINGS_KEY);
  if (!row?.value) {
    memoryRegistry = { sessions: {} };
    return memoryRegistry;
  }
  try {
    const parsed = JSON.parse(row.value) as MonitoringSessionRegistry;
    const sessions: Record<string, MonitoringSession> = {};
    Object.entries(parsed.sessions ?? {}).forEach(([id, session]) => {
      if (session.status === 'stopped' || session.status === 'revoked') return;
      sessions[id] = {
        ...session,
        mockTicking: false,
        mockResumePending: Boolean(session.monitorActive || session.ventilatorActive),
      };
    });
    memoryRegistry = {
      sessions,
      mockBoundRecordLocalId: undefined,
    };
    return memoryRegistry;
  } catch {
    memoryRegistry = { sessions: {} };
    return memoryRegistry;
  }
}

export async function persistMonitoringRegistry(registry: MonitoringSessionRegistry = memoryRegistry): Promise<void> {
  const db = getAnesthesiaLocalDb();
  const sessions: Record<string, MonitoringSession> = {};
  Object.entries(registry.sessions).forEach(([id, session]) => {
    if (session.status === 'stopped' || session.status === 'revoked') return;
    sessions[id] = { ...session, mockTicking: false };
  });
  if (!Object.keys(sessions).length) {
    await db.settings.delete(MONITORING_SESSION_SETTINGS_KEY);
    memoryRegistry = { sessions: {} };
    return;
  }
  await db.settings.put({
    key: MONITORING_SESSION_SETTINGS_KEY,
    value: JSON.stringify({ sessions, mockBoundRecordLocalId: registry.mockBoundRecordLocalId }),
    updated_at: dayjs().toISOString(),
  });
}

export function buildMonitoringSessionFromCase(caseItem: SurgeryCase): MonitoringSession {
  const now = dayjs().toISOString();
  return {
    sessionId: `mon-session-${caseItem.id}-${Date.now()}`,
    recordLocalId: caseItem.id,
    patientId: caseItem.patientId ?? caseItem.id,
    patientName: caseItem.patientName,
    surgeryName: caseItem.surgeryName,
    room: caseItem.room,
    operationId: caseItem.id,
    status: 'active',
    monitorActive: false,
    ventilatorActive: false,
    mockTicking: false,
    mockResumePending: false,
    startedAt: now,
    lastCollectTime: caseItem.device?.lastCollectTime,
  };
}

export function findRunningSessionOnOtherRecord(
  viewRecordLocalId: string,
  registry: MonitoringSessionRegistry = memoryRegistry,
): MonitoringSession | null {
  return Object.values(registry.sessions).find((session) => (
    session.recordLocalId !== viewRecordLocalId
    && session.status !== 'stopped'
    && session.status !== 'revoked'
    && (session.monitorActive || session.ventilatorActive)
  )) ?? null;
}

export function resolveMonitoringViewUi(
  viewRecordLocalId: string,
  registry: MonitoringSessionRegistry = memoryRegistry,
): MonitoringViewUi {
  const session = registry.sessions[viewRecordLocalId] ?? null;
  const foreign = findRunningSessionOnOtherRecord(viewRecordLocalId, registry);

  if (!session || session.status === 'stopped' || session.status === 'revoked') {
    return {
      monitorRunning: false,
      ventilatorRunning: false,
      mockTicking: false,
      sessionOnOtherCase: Boolean(foreign),
      sessionOwnerLabel: foreign ? `${foreign.room} ${foreign.patientName}` : undefined,
      monitoringPaused: false,
      resumePending: false,
      hasMonitorSession: false,
      hasVentilatorSession: false,
    };
  }

  const devicesActive = session.monitorActive || session.ventilatorActive;
  const ticking = session.mockTicking
    && registry.mockBoundRecordLocalId === viewRecordLocalId
    && devicesActive;

  return {
    monitorRunning: session.monitorActive && ticking,
    ventilatorRunning: session.ventilatorActive && ticking,
    mockTicking: ticking,
    sessionOnOtherCase: Boolean(foreign),
    sessionOwnerLabel: foreign ? `${foreign.room} ${foreign.patientName}` : undefined,
    monitoringPaused: devicesActive && !ticking,
    resumePending: session.mockResumePending,
    hasMonitorSession: session.monitorActive,
    hasVentilatorSession: session.ventilatorActive,
  };
}

export function prepareScopeSwitchHint(
  fromRecordLocalId: string,
  toRecordLocalId: string,
  registry: MonitoringSessionRegistry = memoryRegistry,
): ScopeSwitchHint {
  const session = registry.sessions[fromRecordLocalId];
  if (!session || session.status === 'stopped' || session.status === 'revoked') {
    return { needConfirm: false };
  }
  if (toRecordLocalId === fromRecordLocalId) return { needConfirm: false };
  if (!session.monitorActive && !session.ventilatorActive) return { needConfirm: false };

  const owner = `${session.room} ${session.patientName}`;
  return {
    needConfirm: true,
    message: `当前患者（${owner}）监护正在运行，切换后监护数据仍归属原患者，不会写入新患者记录单。`,
  };
}

export function markMockPaused(session: MonitoringSession): MonitoringSession {
  return {
    ...session,
    mockTicking: false,
    mockResumePending: false,
    status: session.status === 'active' ? 'paused' : session.status,
  };
}

export function markMockTicking(
  session: MonitoringSession,
  ticking: boolean,
  registry: MonitoringSessionRegistry = memoryRegistry,
): { session: MonitoringSession; registry: MonitoringSessionRegistry } {
  const nextSession: MonitoringSession = {
    ...session,
    mockTicking: ticking,
    mockResumePending: ticking ? false : session.mockResumePending,
    status: ticking ? 'active' : session.status,
  };
  upsertSession(nextSession);
  memoryRegistry = {
    ...memoryRegistry,
    mockBoundRecordLocalId: ticking ? session.recordLocalId : (
      memoryRegistry.mockBoundRecordLocalId === session.recordLocalId ? undefined : memoryRegistry.mockBoundRecordLocalId
    ),
  };
  return { session: nextSession, registry: memoryRegistry };
}

export function saveSession(session: MonitoringSession) {
  upsertSession(session);
}

export function finalizeStoppedSession(session: MonitoringSession): MonitoringSession {
  return {
    ...session,
    monitorActive: false,
    ventilatorActive: false,
    mockTicking: false,
    mockResumePending: false,
    status: 'stopped',
    stoppedAt: dayjs().toISOString(),
  };
}

export function finalizeRevokedSession(session: MonitoringSession, reason: string): MonitoringSession {
  return {
    ...session,
    monitorActive: false,
    ventilatorActive: false,
    mockTicking: false,
    mockResumePending: false,
    status: 'revoked',
    stoppedAt: dayjs().toISOString(),
    revokeReason: reason,
  };
}

export function clearAwayMockTimeout() {
  if (awayTimeoutId) {
    clearTimeout(awayTimeoutId);
    awayTimeoutId = undefined;
  }
}

export function scheduleAwayMockTimeout(onTimeout: () => void) {
  clearAwayMockTimeout();
  awayTimeoutId = setTimeout(() => {
    awayTimeoutId = undefined;
    onTimeout();
  }, MONITORING_MOCK_AWAY_TIMEOUT_MS);
}

export function dropSession(recordLocalId: string) {
  removeSession(recordLocalId);
}
