import dayjs from 'dayjs';

import type { AnesthesiaRecordDeviceState, SurgeryCase, VitalSign } from '@/types/anesthesia';

import { isRescueModeActive, resolveRecordSheetNowIso, timeToFractionalMinutes } from '@/services/anesthesiaRecordEngine';

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

export function resolveVitalBucketKey(ts: string, displayIntervalMinutes: number) {
  const mins = timeToFractionalMinutes(dayjs(ts).format('HH:mm:ss'));
  if (mins === null) return `${displayIntervalMinutes}-0`;
  return `${displayIntervalMinutes}-${Math.floor(mins / displayIntervalMinutes)}`;
}

/**
 * 归一化时间槽标准时间（秒归零、整刻度对齐），monitor 与 ventilator 共用同一分桶规则，
 * 与后端 ingest 的整 5 分钟 / 抢救 1 分钟刻度一致。
 * 例：10:07:32 → 10:05:00；10:09:59 → 10:05:00；10:10:00 → 10:10:00。
 */
export function resolveVitalSlotTime(ts: string, displayIntervalMinutes: number): string {
  const d = dayjs(ts);
  const mins = timeToFractionalMinutes(d.format('HH:mm:ss'));
  if (mins === null) return ts;
  const slotStart = Math.floor(mins / displayIntervalMinutes) * displayIntervalMinutes;
  return d.startOf('day').add(slotStart, 'minute').format('YYYY-MM-DDTHH:mm:00');
}

/**
 * 代表点稳定幂等 ID：由 recordLocalId + 数据类型 + 槽时间决定。
 * 同一槽位刷新/重连/重复报文均产生同一 ID，避免每次模拟随机生成导致服务端幂等命中旧值。
 */
export function buildStableVitalId(recordLocalId: string, slotTime: string, kind: 'monitor' | 'ventilator' = 'monitor'): string {
  return `vitslot-${kind}-${recordLocalId}-${dayjs(slotTime).format('YYYYMMDDHHmm')}`;
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
  const rescueForced = options?.rescueMode ?? isRescueDeviceSimulation(simulationMode);
  const rawIntervalMs = resolveDeviceRawIntervalMs(simulationMode);

  // 显示体征采集间隔按【当前病例抢救态】每 tick 实时解析，而非启动时一次性冻结。
  // 这样退出/清除抢救后，下一 tick 立即恢复 5 分钟；抢救有效期内保持 1 分钟。
  const displayIntervalFor = (caseItem: SurgeryCase): number => resolveMonitorDisplayIntervalMinutes({
    rescueMode: rescueForced || isRescueModeActive(caseItem),
    simulationMode,
    displayIntervalMinutes: options?.displayIntervalMinutes,
  });

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
    // 时间槽与后端 ingest 一致：常规整 5 分钟、抢救 1 分钟，按 floor(分钟/间隔) 整刻度对齐。
    // 间隔每 tick 按当前病例抢救态解析（退出抢救后立即恢复 5 分钟）。
    const displayIntervalMinutes = displayIntervalFor(caseItem);
    const slotTime = resolveVitalSlotTime(ts, displayIntervalMinutes);
    const bucketKey = resolveVitalBucketKey(ts, displayIntervalMinutes);

    const displaySample = simulationMode === 'abnormal'
      ? buildMonitorSample({ abnormal: true, abnormalType: pickAbnormalSimulationType(abnormalTypes) })
      : sample;

    // 严格按时间槽匹配（不再用“±间隔分钟”的跨槽就近合并），保证每槽一个代表点。
    const existingIndex = caseItem.vitals.findIndex((v) =>
      resolveVitalBucketKey(String(v.time ?? ''), displayIntervalMinutes) === bucketKey,
    );
    // 人工录入或人工修正的数据优先，设备不得覆盖。
    if (existingIndex >= 0 && !canDeviceOverwriteVital(caseItem.vitals[existingIndex], '设备采集')) {
      return;
    }

    const isNewBucket = existingIndex < 0;
    // 稳定 ID：新槽生成确定性 ID；同槽更新复用既有 ID，保证服务端按主键更新而非重复 create。
    const stableId = isNewBucket ? buildStableVitalId(recordLocalId, slotTime, 'monitor') : (caseItem.vitals[existingIndex].id ?? buildStableVitalId(recordLocalId, slotTime, 'monitor'));
    const vital: VitalSign = {
      id: stableId,
      // 业务 time 归一为槽标准时间（整刻度、秒归零）；设备实际采集时间仍保留在 monitor_raw。
      time: slotTime,
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
      // 同一时间槽选取最新有效样本覆盖（与后端 upsert 一致），保留稳定 id。
      const existing = caseItem.vitals[existingIndex];
      caseItem.vitals[existingIndex] = { ...existing, ...vital };
    } else {
      caseItem.vitals.push(vital);
    }
    const savedVital = existingIndex >= 0 ? caseItem.vitals[existingIndex] : vital;
    const db = getAnesthesiaLocalDb();
    await db.vital_signs.put(mapVitalToRow(recordLocalId, savedVital, 1));
    const vitalBaseVersion = await readEntityBaseSyncVersion(recordLocalId, 'vital_sign', savedVital.id!);
    // 设备派生 vital_sign 门控：仅当开启真实设备同步（3d）才入队；手工 vital 由 store 另行走 vital_sign 处理器。
    // 首次写入 create；同槽已存在用 update，携带稳定主键，避免服务端幂等返回旧值静默覆盖前端最新状态。
    if (useRealDevice()) {
      await enqueueSyncItem({
        recordLocalId,
        operationId: recordLocalId,
        entityType: 'vital_sign',
        entityLocalId: savedVital.id!,
        operationType: isNewBucket ? 'create' : 'update',
        baseSyncVersion: vitalBaseVersion,
        apiPath: ANESTHESIA_SYNC_QUEUE_API_PATH,
        payload: savedVital,
      });
      triggerAnesthesiaSyncAfterChange('vital_sign');
    }
    // 仅在新代表点出现时回调（最近记录/刷新），同槽覆盖静默更新数值。
    if (isNewBucket) onVitalAppended(recordLocalId, savedVital);

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
