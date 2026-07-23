import dayjs from 'dayjs';

import type { SurgeryCase, VitalSign } from '@/types/anesthesia';

import { isRescueModeActive, resolveRecordSheetNowIso } from '@/services/anesthesiaRecordEngine';

import { getAnesthesiaLocalDb } from '@/services/anesthesia/localDb';

import { mapVitalToRow } from '@/services/anesthesia/anesthesiaRecordRepository';

import { canDeviceOverwriteVital, findExistingDeviceRaw } from '@/services/anesthesia/anesthesiaSyncConflict';

import { ANESTHESIA_SYNC_QUEUE_API_PATH, readEntityBaseSyncVersion, enqueueSyncItem } from '@/services/anesthesia/anesthesiaSyncQueue';

import { triggerAnesthesiaSyncAfterChange } from '@/services/anesthesia/anesthesiaSyncService';

import { useRealDevice } from '@/config/apiFlags';

import { buildVentilatorSample } from '@/services/anesthesia/deviceMockSamples';
import { notifySimulatedDeviceDataCollected } from '@/services/anesthesia/deviceRealtimeSource';

import {
  isRescueDeviceSimulation,
  pickAbnormalSimulationType,
  readAbnormalSimulationTypes,
  readDeviceSimulationMode,
  resolveDeviceRawIntervalMs,
} from '@/services/anesthesia/deviceSimulationMode';

import {
  resolveMonitorDisplayIntervalMinutes,
  resolveVitalBucketKey,
  resolveVitalSlotTime,
  buildStableVitalId,
  type MonitorMockOptions,
} from '@/services/anesthesia/monitorMockService';

const DEVICE_ID = 'ventilator_mock_01';

const SOURCE_DEVICE = 'ventilator_mock';

export interface VentilatorMockHandle {
  stop: () => void;
}

export function startVentilatorMockService(
  recordLocalId: string,
  resolveCase: () => SurgeryCase | undefined,
  onVitalAppended: (caseId: string, vital: VitalSign) => void,
  options?: MonitorMockOptions,
): VentilatorMockHandle {
  let stopped = false;
  const simulationMode = options?.simulationMode ?? readDeviceSimulationMode();
  const abnormalTypes = options?.abnormalTypes ?? readAbnormalSimulationTypes();
  const rescueForced = options?.rescueMode ?? isRescueDeviceSimulation(simulationMode);
  const rawIntervalMs = resolveDeviceRawIntervalMs(simulationMode);

  // 显示体征采集间隔按【当前病例抢救态】每 tick 实时解析，而非启动时一次性冻结。
  // 退出/清除抢救后下一 tick 立即恢复 5 分钟；抢救有效期内保持 1 分钟。
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
      return buildVentilatorSample({
        abnormal: true,
        abnormalType: pickAbnormalSimulationType(abnormalTypes),
      });
    }
    if (simulationMode === 'abnormal' && Math.random() < 0.25) {
      return buildVentilatorSample({
        abnormal: true,
        abnormalType: pickAbnormalSimulationType(abnormalTypes),
      });
    }
    return buildVentilatorSample({ rescueChaos: simulationMode === 'rescue' });
  };

  const persistRaw = async (ts: string, sample: ReturnType<typeof buildVentilatorSample>) => {
    const db = getAnesthesiaLocalDb();
    const localId = `ventilator-${Date.now()}`;
    const existingRaw = await findExistingDeviceRaw('ventilator_raw', recordLocalId, localId, ts);
    if (existingRaw) return;

    await db.ventilator_raw.put({
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
    options?.onRaw?.(recordLocalId, 'ventilator', {
      localId,
      operationId: recordLocalId,
      deviceId: DEVICE_ID,
      sourceDevice: SOURCE_DEVICE,
      deviceType: 'ventilator',
      collectTime: ts,
      ventMode: sample.vent_mode,
      tidalVolume: sample.tidal_volume,
      respiratoryRate: sample.respiratory_rate,
      fio2: sample.fio2,
      peep: sample.peep,
      peakPressure: sample.peak_pressure,
      plateauPressure: sample.plateau_pressure,
      minuteVolume: sample.minute_volume,
      airwayPressure: sample.airway_pressure,
      etco2: sample.etco2,
    });

    const rawBaseVersion = await readEntityBaseSyncVersion(recordLocalId, 'ventilator_raw', localId);
    // device 实体（ventilator_raw）门控：仅当开启真实设备同步（3d）才入队，防风暴。
    if (useRealDevice()) {
      await enqueueSyncItem({
        recordLocalId,
        operationId: recordLocalId,
        entityType: 'ventilator_raw',
        entityLocalId: localId,
        operationType: 'create',
        baseSyncVersion: rawBaseVersion,
        apiPath: '/api-samis/pc/v1/anesthesiaDevice/batchPushVentilatorData',
        payload: {
          localId,
          collectTime: dayjs(ts).format('YYYY-MM-DD HH:mm:ss.SSS'),
          ...sample,
          rawPayload: JSON.stringify(sample),
        },
      });
      triggerAnesthesiaSyncAfterChange('ventilator_raw');
    }
  };

  const maybePersistDisplayVital = async (ts: string, sample: ReturnType<typeof buildVentilatorSample>, caseItem: SurgeryCase) => {
    // 时间槽与后端 ingest 一致，与 monitor 复用同一分桶规则。间隔每 tick 按当前抢救态解析。
    const displayIntervalMinutes = displayIntervalFor(caseItem);
    const slotTime = resolveVitalSlotTime(ts, displayIntervalMinutes);
    const bucketKey = resolveVitalBucketKey(ts, displayIntervalMinutes);

    const displaySample = simulationMode === 'abnormal'
      ? buildVentilatorSample({ abnormal: true, abnormalType: pickAbnormalSimulationType(abnormalTypes) })
      : sample;

    // 严格按时间槽匹配，保证每槽一个代表点。
    const existingIndex = caseItem.vitals.findIndex((v) =>
      resolveVitalBucketKey(String(v.time ?? ''), displayIntervalMinutes) === bucketKey,
    );
    // 人工录入或人工修正的数据优先，设备不得覆盖。
    if (existingIndex >= 0 && !canDeviceOverwriteVital(caseItem.vitals[existingIndex], '设备采集')) {
      return;
    }

    const isNewBucket = existingIndex < 0;
    const stableId = isNewBucket ? buildStableVitalId(recordLocalId, slotTime, 'ventilator') : (caseItem.vitals[existingIndex].id ?? buildStableVitalId(recordLocalId, slotTime, 'ventilator'));
    const vital: VitalSign = {
      id: stableId,
      // 业务 time 归一为槽标准时间；设备实际采集时间仍保留在 ventilator_raw。
      time: slotTime,
      RR: displaySample.respiratory_rate,
      EtCO2: displaySample.etco2,
      source: '设备采集',
      monitorExtras: { airwayPressure: displaySample.airway_pressure },
    };
    if (existingIndex >= 0) {
      // 同一时间槽选取最新有效样本覆盖（与后端 upsert 一致），保留稳定 id。
      const existing = caseItem.vitals[existingIndex];
      caseItem.vitals[existingIndex] = {
        ...existing,
        ...vital,
        RR: displaySample.respiratory_rate ?? existing.RR,
        EtCO2: displaySample.etco2 ?? existing.EtCO2,
        monitorExtras: {
          ...existing.monitorExtras,
          airwayPressure: displaySample.airway_pressure,
        },
      };
    } else {
      caseItem.vitals.push(vital);
    }
    const savedVital = existingIndex >= 0 ? caseItem.vitals[existingIndex] : vital;
    const db = getAnesthesiaLocalDb();
    await db.vital_signs.put(mapVitalToRow(recordLocalId, savedVital, 1));
    const vitalBaseVersion = await readEntityBaseSyncVersion(recordLocalId, 'vital_sign', savedVital.id!);
    // 设备派生 vital_sign 门控：首次 create；同槽已存在用 update，携带稳定主键。
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
      await persistRaw(ts, sample);
      options?.onCollect?.(recordLocalId, ts);
      try {
        await maybePersistDisplayVital(ts, sample, caseItem);
      } catch (error) {
        console.warn('[ventilator-mock] 原始帧已采集，但本次体征入单失败', error);
      }
    } catch (error) {
      console.warn('[ventilator-mock] 本次模拟原始帧采集失败，将按周期重试', error);
    } finally {
      if (!stopped) setTimeout(rawTick, rawIntervalMs);
    }
  };

  // 启动后立即采集首帧；后续仍按配置间隔采集。
  void rawTick();
  return {
    stop: () => {
      stopped = true;
    },
  };
}
