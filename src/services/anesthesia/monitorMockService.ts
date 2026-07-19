import dayjs from 'dayjs';

import type { AnesthesiaRecordDeviceState, SurgeryCase, VitalSign } from '@/types/anesthesia';

import { resolveRecordSheetNowIso, timeToFractionalMinutes } from '@/services/anesthesiaRecordEngine';

import { getAnesthesiaLocalDb } from '@/services/anesthesia/localDb';

import { mapVitalToRow } from '@/services/anesthesia/anesthesiaRecordRepository';

import { canDeviceOverwriteVital, findExistingDeviceRaw } from '@/services/anesthesia/anesthesiaSyncConflict';

import { ANESTHESIA_SYNC_QUEUE_API_PATH, readEntityBaseSyncVersion, enqueueSyncItem } from '@/services/anesthesia/anesthesiaSyncQueue';

import { triggerAnesthesiaSyncAfterChange } from '@/services/anesthesia/anesthesiaSyncService';

import { useRealDevice } from '@/config/apiFlags';

import { buildMonitorSample } from '@/services/anesthesia/deviceMockSamples';
import { notifySimulatedDeviceDataCollected } from '@/services/anesthesia/deviceRealtimeSource';
import type { LatestDeviceRawApi } from '@/api/anesthesiaSync';

import {
  type AbnormalSimulationType,
  type DeviceSimulationMode,
  isRescueDeviceSimulation,
  pickAbnormalSimulationType,
  readAbnormalSimulationTypes,
  readDeviceSimulationMode,
  resolveDeviceRawIntervalMs,
} from '@/services/anesthesia/deviceSimulationMode';

const DEVICE_ID = 'monitor_mock_01';

const SOURCE_DEVICE = 'monitor_mock';

export const DEFAULT_MONITOR_DISPLAY_INTERVAL_MINUTES = 5;

export const RESCUE_MONITOR_DISPLAY_INTERVAL_MINUTES = 1;

export const MONITOR_DISPLAY_INTERVAL_STORAGE_KEY = 'samis.anesthesia.monitorDisplayIntervalMinutes';

export const DEVICE_RAW_COLLECTION_INTERVAL_MS = 4000;

export function clampMonitorDisplayIntervalMinutes(value?: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_MONITOR_DISPLAY_INTERVAL_MINUTES;
  return Math.max(1, Math.min(5, Math.round(parsed)));
}

export function resolveMonitorDisplayIntervalMinutes(options?: {
  rescueMode?: boolean;
  simulationMode?: DeviceSimulationMode;
  displayIntervalMinutes?: number;
}): number {
  if (options?.rescueMode || options?.simulationMode === 'rescue') {
    return RESCUE_MONITOR_DISPLAY_INTERVAL_MINUTES;
  }
  return clampMonitorDisplayIntervalMinutes(options?.displayIntervalMinutes);
}

export function readMonitorDisplayIntervalMinutes(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_MONITOR_DISPLAY_INTERVAL_MINUTES;
  return clampMonitorDisplayIntervalMinutes(Number(localStorage.getItem(MONITOR_DISPLAY_INTERVAL_STORAGE_KEY)));
}

function resolveVitalBucketKey(ts: string, displayIntervalMinutes: number) {
  const mins = timeToFractionalMinutes(dayjs(ts).format('HH:mm:ss'));
  if (mins === null) return `${displayIntervalMinutes}-0`;
  return `${displayIntervalMinutes}-${Math.floor(mins / displayIntervalMinutes)}`;
}

function resolveCollectStatus(_mode: DeviceSimulationMode): AnesthesiaRecordDeviceState['collectStatus'] {
  return '采集中';
}

export interface MonitorMockHandle {
  stop: () => void;
}

export interface MonitorMockOptions {
  rescueMode?: boolean;
  displayIntervalMinutes?: number;
  simulationMode?: DeviceSimulationMode;
  abnormalTypes?: AbnormalSimulationType[];
  onCollect?: (recordLocalId: string, ts: string) => void;
  onRaw?: (recordLocalId: string, deviceType: 'monitor' | 'ventilator', raw: LatestDeviceRawApi) => void;
}

export function startMonitorMockService(
  recordLocalId: string,
  resolveCase: () => SurgeryCase | undefined,
  onVitalAppended: (caseId: string, vital: VitalSign) => void,
  options?: MonitorMockOptions,
): MonitorMockHandle {
  let stopped = false;
  const simulationMode = options?.simulationMode ?? readDeviceSimulationMode();
  const abnormalTypes = options?.abnormalTypes ?? readAbnormalSimulationTypes();
  const rescueMode = options?.rescueMode ?? isRescueDeviceSimulation(simulationMode);
  const displayIntervalMinutes = resolveMonitorDisplayIntervalMinutes({
    rescueMode,
    simulationMode,
    displayIntervalMinutes: options?.displayIntervalMinutes,
  });
  const rawIntervalMs = resolveDeviceRawIntervalMs(simulationMode);
  let lastVitalBucketKey = '';

  const resolveBoundCase = () => {
    const caseItem = resolveCase();
    if (!caseItem || caseItem.id !== recordLocalId) return undefined;
    if (caseItem.locked) return undefined;
    return caseItem;
  };

  const buildSample = (forDisplay: boolean) => {
    if (simulationMode === 'abnormal' && forDisplay) {
      return buildMonitorSample({
        abnormal: true,
        abnormalType: pickAbnormalSimulationType(abnormalTypes),
      });
    }
    if (simulationMode === 'abnormal' && Math.random() < 0.25) {
      return buildMonitorSample({
        abnormal: true,
        abnormalType: pickAbnormalSimulationType(abnormalTypes),
      });
    }
    return buildMonitorSample({ rescueChaos: simulationMode === 'rescue' });
  };

  const persistRaw = async (ts: string, sample: ReturnType<typeof buildMonitorSample>, caseItem: SurgeryCase) => {
    const db = getAnesthesiaLocalDb();
    const localId = `monitor-${Date.now()}`;
    const existingRaw = await findExistingDeviceRaw('monitor_raw', recordLocalId, localId, ts);
    if (existingRaw) return;

    await db.monitor_raw.put({
      local_id: localId,
      record_local_id: recordLocalId,
      operation_id: recordLocalId,
      collect_time: ts,
      ...sample,
      source_device: SOURCE_DEVICE,
      device_id: DEVICE_ID,
      raw_payload: JSON.stringify(sample),
      sync_status: 'local_only',
      sync_version: 1,
      created_at: ts,
      updated_at: ts,
    });
    notifySimulatedDeviceDataCollected(recordLocalId);
    options?.onRaw?.(recordLocalId, 'monitor', {
      localId,
      operationId: recordLocalId,
      deviceId: DEVICE_ID,
      sourceDevice: SOURCE_DEVICE,
      deviceType: 'monitor',
      collectTime: ts,
      hr: sample.hr,
      pulse: sample.pulse,
      sbp: sample.sbp,
      dbp: sample.dbp,
      mapValue: sample.map_value,
      spo2: sample.spo2,
      temperature: sample.temperature,
      respiration: sample.respiration,
      bis: sample.bis,
      etco2: sample.etco2,
    });

    const rawBaseVersion = await readEntityBaseSyncVersion(recordLocalId, 'monitor_raw', localId);
    // device 实体（monitor_raw）门控：仅当开启真实设备同步（3d）才入队，防风暴。
    if (useRealDevice()) {
      await enqueueSyncItem({
        recordLocalId,
        operationId: recordLocalId,
        entityType: 'monitor_raw',
        entityLocalId: localId,
        operationType: 'create',
        baseSyncVersion: rawBaseVersion,
        apiPath: '/api-samis/pc/v1/anesthesiaDevice/batchPushMonitorData',
        payload: {
          localId,
          collectTime: dayjs(ts).format('YYYY-MM-DD HH:mm:ss.SSS'),
          ...sample,
          mapValue: sample.map_value,
          rawPayload: JSON.stringify(sample),
        },
      });
      triggerAnesthesiaSyncAfterChange('monitor_raw');
    }
  };

  const maybePersistDisplayVital = async (ts: string, sample: ReturnType<typeof buildMonitorSample>, caseItem: SurgeryCase) => {
    const bucketKey = resolveVitalBucketKey(ts, displayIntervalMinutes);
    if (bucketKey === lastVitalBucketKey) return;

    const displaySample = simulationMode === 'abnormal'
      ? buildMonitorSample({ abnormal: true, abnormalType: pickAbnormalSimulationType(abnormalTypes) })
      : sample;

    const existingIndex = caseItem.vitals.findIndex((v) =>
      Math.abs(dayjs(v.time).diff(ts, 'minute')) < displayIntervalMinutes,
    );
    if (existingIndex >= 0 && !canDeviceOverwriteVital(caseItem.vitals[existingIndex], '设备采集')) {
      lastVitalBucketKey = bucketKey;
      return;
    }

    const vital: VitalSign = {
      id: `vital-${Date.now()}`,
      time: ts,
      HR: displaySample.hr,
      SBP: displaySample.sbp,
      DBP: displaySample.dbp,
      MAP: displaySample.map_value,
      SpO2: displaySample.spo2,
      TEMP: displaySample.temperature,
      RR: displaySample.respiration,
      BIS: displaySample.bis,
      EtCO2: displaySample.etco2,
      source: '设备采集',
    };
    if (existingIndex >= 0) {
      const existing = caseItem.vitals[existingIndex];
      vital.id = existing.id ?? vital.id;
      caseItem.vitals[existingIndex] = { ...existing, ...vital };
    } else {
      caseItem.vitals.push(vital);
    }
    const savedVital = existingIndex >= 0 ? caseItem.vitals[existingIndex] : vital;
    const db = getAnesthesiaLocalDb();
    await db.vital_signs.put(mapVitalToRow(recordLocalId, savedVital, 1));
    const vitalBaseVersion = await readEntityBaseSyncVersion(recordLocalId, 'vital_sign', savedVital.id!);
    // 设备派生 vital_sign 门控：仅当开启真实设备同步（3d）才入队；手工 vital 由 store 另行走 vital_sign 处理器。
    if (useRealDevice()) {
      await enqueueSyncItem({
        recordLocalId,
        operationId: recordLocalId,
        entityType: 'vital_sign',
        entityLocalId: savedVital.id!,
        operationType: 'create',
        baseSyncVersion: vitalBaseVersion,
        apiPath: ANESTHESIA_SYNC_QUEUE_API_PATH,
        payload: savedVital,
      });
      triggerAnesthesiaSyncAfterChange('vital_sign');
    }
    onVitalAppended(recordLocalId, savedVital);
    lastVitalBucketKey = bucketKey;

    if (caseItem.device) {
      caseItem.device.lastCollectTime = ts;
      caseItem.device.collectStatus = resolveCollectStatus(simulationMode);
    }
  };

  const rawTick = async () => {
    if (stopped) return;
    const caseItem = resolveBoundCase();
    if (!caseItem) {
      if (!stopped) setTimeout(rawTick, rawIntervalMs);
      return;
    }
    try {
      const ts = resolveRecordSheetNowIso(caseItem);
      const sample = buildSample(false);
      sample.pulse = sample.hr;
      sample.map_value = Math.round((sample.sbp + sample.dbp * 2) / 3);
      await persistRaw(ts, sample, caseItem);
      options?.onCollect?.(recordLocalId, ts);
      try {
        await maybePersistDisplayVital(ts, sample, caseItem);
      } catch (error) {
        console.warn('[monitor-mock] 原始帧已采集，但本次体征入单失败', error);
      }
    } catch (error) {
      console.warn('[monitor-mock] 本次模拟原始帧采集失败，将按周期重试', error);
    } finally {
      if (!stopped) setTimeout(rawTick, rawIntervalMs);
    }
  };

  const bootCase = resolveBoundCase();
  if (bootCase?.device) {
    bootCase.device.collectStatus = resolveCollectStatus(simulationMode);
  }

  // 启动后立即采集首帧；后续仍按配置间隔采集，避免用户点击“启监护仪”后长时间空白。
  void rawTick();
  return {
    stop: () => {
      stopped = true;
    },
  };
}
