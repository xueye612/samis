import dayjs from 'dayjs';

import type { SurgeryCase, VitalSign } from '@/types/anesthesia';

import { resolveRecordSheetNowIso, timeToFractionalMinutes } from '@/services/anesthesiaRecordEngine';

import { getAnesthesiaLocalDb } from '@/services/anesthesia/localDb';

import { mapVitalToRow } from '@/services/anesthesia/anesthesiaRecordRepository';

import { canDeviceOverwriteVital, findExistingDeviceRaw } from '@/services/anesthesia/anesthesiaSyncConflict';

import { readEntityBaseSyncVersion, enqueueSyncItem } from '@/services/anesthesia/anesthesiaSyncQueue';

import { triggerAnesthesiaSyncAfterChange } from '@/services/anesthesia/anesthesiaSyncService';

import { buildVentilatorSample } from '@/services/anesthesia/deviceMockSamples';

import {
  isRescueDeviceSimulation,
  pickAbnormalSimulationType,
  readAbnormalSimulationTypes,
  readDeviceSimulationMode,
  resolveDeviceRawIntervalMs,
} from '@/services/anesthesia/deviceSimulationMode';

import {
  resolveMonitorDisplayIntervalMinutes,
  type MonitorMockOptions,
} from '@/services/anesthesia/monitorMockService';

const DEVICE_ID = 'ventilator_mock_01';

const SOURCE_DEVICE = 'ventilator_mock';

function resolveVitalBucketKey(ts: string, displayIntervalMinutes: number) {
  const mins = timeToFractionalMinutes(dayjs(ts).format('HH:mm:ss'));
  if (mins === null) return `${displayIntervalMinutes}-0`;
  return `${displayIntervalMinutes}-${Math.floor(mins / displayIntervalMinutes)}`;
}

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

    const rawBaseVersion = await readEntityBaseSyncVersion(recordLocalId, 'ventilator_raw', localId);
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
  };

  const maybePersistDisplayVital = async (ts: string, sample: ReturnType<typeof buildVentilatorSample>, caseItem: SurgeryCase) => {
    const bucketKey = resolveVitalBucketKey(ts, displayIntervalMinutes);
    if (bucketKey === lastVitalBucketKey) return;

    const displaySample = simulationMode === 'abnormal'
      ? buildVentilatorSample({ abnormal: true, abnormalType: pickAbnormalSimulationType(abnormalTypes) })
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
      RR: displaySample.respiratory_rate,
      EtCO2: displaySample.etco2,
      source: '设备采集',
      monitorExtras: { airwayPressure: displaySample.airway_pressure },
    };
    if (existingIndex >= 0) {
      const existing = caseItem.vitals[existingIndex];
      vital.id = existing.id ?? vital.id;
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
    await enqueueSyncItem({
      recordLocalId,
      operationId: recordLocalId,
      entityType: 'vital_sign',
      entityLocalId: savedVital.id!,
      operationType: 'create',
      baseSyncVersion: vitalBaseVersion,
      apiPath: '/api-samis/pc/v1/anesthesiaRecord/batchSaveVitalSigns',
      payload: savedVital,
    });
    triggerAnesthesiaSyncAfterChange('vital_sign');
    onVitalAppended(recordLocalId, savedVital);
    lastVitalBucketKey = bucketKey;
  };

  const rawTick = async () => {
    if (stopped) return;
    const caseItem = resolveBoundCase();
    if (!caseItem) {
      if (!stopped) setTimeout(rawTick, rawIntervalMs);
      return;
    }
    const ts = resolveRecordSheetNowIso(caseItem);
    const sample = buildSample(false);
    await persistRaw(ts, sample);
    await maybePersistDisplayVital(ts, sample, caseItem);
    options?.onCollect?.(recordLocalId, ts);
    if (!stopped) setTimeout(rawTick, rawIntervalMs);
  };

  setTimeout(rawTick, rawIntervalMs);
  return {
    stop: () => {
      stopped = true;
    },
  };
}
