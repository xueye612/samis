import dayjs from 'dayjs';
import type { AnesthesiaRecordDeviceState, SurgeryCase, VitalSign } from '@/types/anesthesia';
import type {
  LocalRecordRow,
  RecordPersistMeta,
  SyncEntityType,
  SyncOperationType,
} from '@/types/anesthesiaLocalDb';
import { getAnesthesiaLocalDb } from '@/services/anesthesia/localDb';
import { enqueueSyncItem } from '@/services/anesthesia/anesthesiaSyncQueue';
import { buildCasePayload } from '@/services/anesthesia/casePayload';

const SETTINGS_CURRENT_RECORD = 'current_record_local_id';
const SETTINGS_CURRENT_PAGE_PREFIX = 'current_page:';

const nowIso = () => dayjs().toISOString();

const medicationModeMap: Record<string, string> = {
  单次用药: 'single',
  持续泵入: 'continuous',
  间断追加: 'intermittent',
};

type SyncMetaCarrier = {
  local_id: string;
  server_id?: number | null;
  sync_version: number;
  sync_status: 'pending' | 'uploading' | 'success' | 'failed' | 'conflict' | 'local_only';
  updated_at: string;
  created_at: string;
  deleted_at?: string;
  void_reason?: string;
};

function mergeEntitySyncMeta<T extends SyncMetaCarrier>(existing: T | undefined, next: T): T {
  if (!existing) return next;
  return {
    ...next,
    server_id: existing.server_id ?? next.server_id,
    sync_version: Math.max(existing.sync_version ?? 1, next.sync_version ?? 1),
    sync_status: existing.sync_status === 'success' ? existing.sync_status : next.sync_status,
    created_at: existing.created_at ?? next.created_at,
    deleted_at: next.deleted_at ?? existing.deleted_at,
    void_reason: next.void_reason ?? existing.void_reason,
  };
}

async function softVoidMissing<T extends SyncMetaCarrier & { record_local_id: string }>(
  table: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<T[]> } }; put: (row: T) => Promise<unknown> },
  recordLocalId: string,
  activeIds: Set<string>,
  voidReason = 'removed_from_case',
) {
  const rows = await table.where('record_local_id').equals(recordLocalId).toArray();
  const ts = nowIso();
  for (const row of rows) {
    if (!activeIds.has(row.local_id) && !row.deleted_at) {
      await table.put({
        ...row,
        deleted_at: ts,
        void_reason: voidReason,
        updated_at: ts,
        sync_status: 'local_only',
      });
    }
  }
}

export function mapVitalToRow(caseId: string, vital: VitalSign, syncVersion: number): ReturnType<typeof mapVitalToRowBase> & {
  deleted_at?: string;
  void_reason?: string;
} {
  return mapVitalToRowBase(caseId, vital, syncVersion);
}

function mapVitalToRowBase(caseId: string, vital: VitalSign, syncVersion: number) {
  const localId = vital.id ?? `vital-${Date.now()}`;
  return {
    local_id: localId,
    record_local_id: caseId,
    operation_id: caseId,
    measure_time: vital.time,
    sbp: vital.SBP,
    dbp: vital.DBP,
    map_value: vital.MAP,
    hr: vital.HR,
    pulse: vital.HR,
    spo2: vital.SpO2,
    etco2: vital.EtCO2,
    bis: vital.BIS,
    temperature: vital.TEMP,
    respiration: vital.RR,
    airway_pressure: typeof vital.monitorExtras?.airwayPressure === 'number' ? vital.monitorExtras.airwayPressure : undefined,
    cvp: vital.CVP,
    source: vital.source,
    source_device: vital.source?.includes('设备') ? 'device' : 'manual',
    is_display_point: vital.status !== 'voided',
    is_corrected: vital.source === '手工修正' || Boolean(vital.correctedValue),
    sync_status: 'local_only' as const,
    sync_version: syncVersion,
    created_at: nowIso(),
    updated_at: nowIso(),
    payload: JSON.stringify(vital),
  };
}

export async function saveCaseToLocalDb(
  caseItem: SurgeryCase,
  currentPage?: number,
  meta?: RecordPersistMeta,
): Promise<void> {
  const db = getAnesthesiaLocalDb();
  const ts = nowIso();
  const page = currentPage ?? (await loadCurrentPageFromLocalDb(caseItem.id));
  const syncVersion = (await db.records.get(caseItem.id))?.sync_version ?? 0;
  const nextVersion = meta?.operationType === 'update' || meta?.entityType ? syncVersion + 1 : Math.max(syncVersion, 1);

  const recordRow: LocalRecordRow = {
    local_id: caseItem.id,
    operation_id: caseItem.id,
    patient_id: caseItem.patientId,
    record_status: caseItem.recordStatus,
    record_start_time: caseItem.actualStart,
    anesthesia_start_time: caseItem.anesthesiaStart,
    anesthesia_end_time: caseItem.anesthesiaEnd,
    surgery_start_time: caseItem.surgeryStart,
    surgery_end_time: caseItem.surgeryEnd,
    current_page: page,
    page_count: caseItem.recordDocument?.pageCount,
    printed_at: caseItem.printedAt ?? caseItem.recordDocument?.printedAt,
    locked_at: caseItem.recordDocument?.lockedAt,
    sync_status: 'local_only',
    sync_version: nextVersion,
    last_saved_at: ts,
    created_at: (await db.records.get(caseItem.id))?.created_at ?? ts,
    updated_at: ts,
    case_payload: JSON.stringify(caseItem),
  };

  await db.transaction('rw', [
    db.records,
    db.snapshots,
    db.timeline_events,
    db.medications,
    db.fluids,
    db.transfusions,
    db.vital_signs,
    db.io_records,
    db.lab_results,
    db.settings,
  ], async () => {
    await db.records.put(recordRow);

    if (caseItem.recordSnapshot) {
      await db.snapshots.put({
        local_id: `${caseItem.id}-snapshot`,
        record_local_id: caseItem.id,
        operation_id: caseItem.id,
        snapshot_payload: JSON.stringify(caseItem.recordSnapshot),
        sync_status: 'local_only',
        sync_version: nextVersion,
        created_at: ts,
        updated_at: ts,
      });
    }

    const existingMeds = await db.medications.where('record_local_id').equals(caseItem.id).toArray();
    const existingFluids = await db.fluids.where('record_local_id').equals(caseItem.id).toArray();
    const existingTrans = await db.transfusions.where('record_local_id').equals(caseItem.id).toArray();
    const existingVitals = await db.vital_signs.where('record_local_id').equals(caseItem.id).toArray();
    const existingEvents = await db.timeline_events.where('record_local_id').equals(caseItem.id).toArray();
    const medMap = new Map(existingMeds.map((row) => [row.local_id, row]));
    const fluidMap = new Map(existingFluids.map((row) => [row.local_id, row]));
    const transMap = new Map(existingTrans.map((row) => [row.local_id, row]));
    const vitalMap = new Map(existingVitals.map((row) => [row.local_id, row]));
    const eventMap = new Map(existingEvents.map((row) => [row.local_id, row]));

    const activeEventIds = new Set<string>();
    const activeMedIds = new Set<string>();
    const activeFluidIds = new Set<string>();
    const activeTransIds = new Set<string>();
    const activeVitalIds = new Set<string>();
    const activeIoIds = new Set<string>();
    const activeLabIds = new Set<string>();

    if (caseItem.events?.length) {
      await db.timeline_events.bulkPut(caseItem.events.map((event) => {
        activeEventIds.add(event.id);
        const base = {
          local_id: event.id,
          record_local_id: caseItem.id,
          operation_id: caseItem.id,
          event_time: event.time,
          event_type: event.type,
          event_name: event.type,
          description: event.treatment,
          source: 'manual',
          sync_status: 'local_only' as const,
          sync_version: nextVersion,
          created_at: ts,
          updated_at: ts,
          deleted_at: event.status === 'voided' ? ts : undefined,
          void_reason: event.status === 'voided' ? (event.voidReason ?? meta?.voidReason ?? 'void') : undefined,
          payload: JSON.stringify(event),
        };
        return mergeEntitySyncMeta(eventMap.get(event.id), base);
      }));
    }

    if (caseItem.medications?.length) {
      await db.medications.bulkPut(caseItem.medications.map((med) => {
        activeMedIds.add(med.id);
        const base = {
          local_id: med.id,
          record_local_id: caseItem.id,
          operation_id: caseItem.id,
          drug_name: med.drug,
          drug_category: med.drugCategory,
          dose: med.dose,
          dose_unit: med.unit,
          route: med.route,
          mode: medicationModeMap[med.mode] ?? med.mode,
          is_special: Boolean(med.isSpecial),
          special_no: med.specialNo,
          special_category: med.specialCategory,
          special_reason: med.specialReason ?? med.reason,
          event_time: med.eventTime ?? (med.mode === '单次用药' || med.mode === '间断追加' ? med.time : undefined),
          rate: med.pumpRate,
          start_time: med.startTime ?? med.time,
          end_time: med.endTime ?? med.stopTime,
          row_index: med.rowIndex,
          display_text: med.displayText ?? `${med.drug}${med.dose ?? ''}${med.unit ?? ''}`,
          source: 'manual',
          sync_status: 'local_only' as const,
          sync_version: nextVersion,
          created_at: ts,
          updated_at: ts,
          deleted_at: med.status === 'voided' ? ts : undefined,
          void_reason: med.status === 'voided' ? (med.voidReason ?? 'void') : undefined,
          payload: JSON.stringify(med),
        };
        return mergeEntitySyncMeta(medMap.get(med.id), base);
      }));
    }

    if (caseItem.fluids?.length) {
      const nonBlood = caseItem.fluids.filter((f) => f.category !== '血液制品');
      const blood = caseItem.fluids.filter((f) => f.category === '血液制品');
      if (nonBlood.length) {
        await db.fluids.bulkPut(nonBlood.map((fluid) => {
          activeFluidIds.add(fluid.id);
          const base = {
            local_id: fluid.id,
            record_local_id: caseItem.id,
            operation_id: caseItem.id,
            fluid_type: fluid.category,
            fluid_name: fluid.name,
            volume: fluid.volume,
            volume_unit: fluid.unit ?? 'ml',
            channel_type: fluid.category,
            start_time: fluid.startTime,
            end_time: fluid.endTime,
            sync_status: 'local_only' as const,
            sync_version: nextVersion,
            created_at: ts,
            updated_at: ts,
            deleted_at: fluid.status === 'voided' ? ts : undefined,
            void_reason: fluid.status === 'voided' ? (fluid.voidReason ?? 'void') : undefined,
            payload: JSON.stringify(fluid),
          };
          return mergeEntitySyncMeta(fluidMap.get(fluid.id), base);
        }));
      }
      if (blood.length) {
        await db.transfusions.bulkPut(blood.map((fluid) => {
          activeTransIds.add(fluid.id);
          const base = {
            local_id: fluid.id,
            record_local_id: caseItem.id,
            operation_id: caseItem.id,
            blood_product: fluid.product ?? fluid.name,
            volume: fluid.volume,
            volume_unit: fluid.unit ?? 'ml',
            channel_type: fluid.category,
            start_time: fluid.startTime,
            end_time: fluid.endTime,
            sync_status: 'local_only' as const,
            sync_version: nextVersion,
            created_at: ts,
            updated_at: ts,
            deleted_at: fluid.status === 'voided' ? ts : undefined,
            void_reason: fluid.status === 'voided' ? (fluid.voidReason ?? 'void') : undefined,
            payload: JSON.stringify(fluid),
          };
          return mergeEntitySyncMeta(transMap.get(fluid.id), base);
        }));
      }
    }

    if (caseItem.vitals?.length) {
      await db.vital_signs.bulkPut(
        caseItem.vitals.map((vital) => {
          const localId = vital.id ?? `vital-${Date.now()}`;
          activeVitalIds.add(localId);
          const base = mapVitalToRow(caseItem.id, { ...vital, id: localId }, nextVersion);
          if (vital.status === 'voided') {
            base.deleted_at = ts;
            base.void_reason = vital.voidReason ?? 'void';
          }
          return mergeEntitySyncMeta(vitalMap.get(localId), base);
        }),
      );
    }

    await softVoidMissing(db.timeline_events, caseItem.id, activeEventIds);
    await softVoidMissing(db.medications, caseItem.id, activeMedIds);
    await softVoidMissing(db.fluids, caseItem.id, activeFluidIds);
    await softVoidMissing(db.transfusions, caseItem.id, activeTransIds);
    await softVoidMissing(db.vital_signs, caseItem.id, activeVitalIds);

    if (caseItem.outputRecords?.length) {
      await db.io_records.bulkPut(caseItem.outputRecords.map((row) => {
        activeIoIds.add(row.id);
        return {
        local_id: row.id,
        record_local_id: caseItem.id,
        operation_id: caseItem.id,
        io_type: row.type,
        volume: row.volume,
        measure_time: row.time,
        sync_status: 'local_only',
        sync_version: nextVersion,
        created_at: ts,
        updated_at: ts,
        deleted_at: row.status === 'voided' ? ts : undefined,
        void_reason: row.status === 'voided' ? (row.voidReason ?? 'void') : undefined,
        payload: JSON.stringify(row),
      };
      }));
      await softVoidMissing(db.io_records, caseItem.id, activeIoIds);
    }

    if (caseItem.labResults?.length) {
      await db.lab_results.bulkPut(caseItem.labResults.map((row) => {
        activeLabIds.add(row.id);
        return {
        local_id: row.id,
        record_local_id: caseItem.id,
        operation_id: caseItem.id,
        measure_time: row.resultTime,
        sync_status: 'local_only',
        sync_version: nextVersion,
        created_at: ts,
        updated_at: ts,
        payload: JSON.stringify(row),
      };
      }));
      await softVoidMissing(db.lab_results, caseItem.id, activeLabIds);
    }

    await db.settings.put({ key: SETTINGS_CURRENT_RECORD, value: caseItem.id, updated_at: ts });
    await db.settings.put({ key: `${SETTINGS_CURRENT_PAGE_PREFIX}${caseItem.id}`, value: String(page), updated_at: ts });
  });

  if (!meta?.skipQueue) {
    const entityType = meta?.entityType ?? 'record';
    const entityLocalId = meta?.entityLocalId ?? caseItem.id;
    const operationType = meta?.operationType ?? 'update';
    const apiPath = meta?.apiPath ?? '/api-samis/pc/v1/anesthesiaRecord/saveRecord';
    // Slice 3f：record 类实体入队时携带 case 级非列表 payload（剥离列表数组），
    // 落入 anes_record.case_payload；列表数据由各自关系子表 sync 项承载。
    const isRecordEntity = entityType === 'record';
    await enqueueSyncItem({
      recordLocalId: caseItem.id,
      operationId: caseItem.id,
      entityType,
      entityLocalId,
      operationType,
      baseSyncVersion: meta?.baseSyncVersion ?? nextVersion,
      apiPath,
      payload: {
        ...(meta?.payload && typeof meta.payload === 'object' ? meta.payload as object : {}),
        localId: entityLocalId,
        serverId: (await db.records.get(caseItem.id))?.server_id ?? null,
        syncVersion: nextVersion,
        baseSyncVersion: meta?.baseSyncVersion ?? nextVersion,
        recordLocked: caseItem.locked,
        recordPrinted: Boolean(caseItem.printedAt),
        voidReason: meta?.voidReason,
        ...(isRecordEntity ? { casePayload: buildCasePayload(caseItem) } : {}),
      },
    });
  }
}

export async function loadCaseFromLocalDb(caseId: string): Promise<SurgeryCase | null> {
  const db = getAnesthesiaLocalDb();
  const row = await db.records.get(caseId);
  if (!row?.case_payload) return null;
  try {
    return JSON.parse(row.case_payload) as SurgeryCase;
  } catch {
    return null;
  }
}

export async function loadAllCasesFromLocalDb(): Promise<SurgeryCase[]> {
  const db = getAnesthesiaLocalDb();
  const rows = await db.records.toArray();
  return rows
    .map((row) => {
      try {
        return JSON.parse(row.case_payload) as SurgeryCase;
      } catch {
        return null;
      }
    })
    .filter((item): item is SurgeryCase => Boolean(item));
}

export async function loadCurrentPageFromLocalDb(caseId: string): Promise<number> {
  const db = getAnesthesiaLocalDb();
  const row = await db.settings.get(`${SETTINGS_CURRENT_PAGE_PREFIX}${caseId}`);
  const page = Number(row?.value ?? 1);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export async function appendAuditLogLocal(recordLocalId: string, action: string, detail: string, operator?: string) {
  const db = getAnesthesiaLocalDb();
  const ts = nowIso();
  await db.audit_logs.put({
    local_id: `audit-${Date.now()}`,
    record_local_id: recordLocalId,
    operation_id: recordLocalId,
    action,
    detail,
    operator,
    created_at: ts,
    payload: JSON.stringify({ action, detail, operator }),
  });
}

export async function saveDeviceVitalOnly(caseItem: SurgeryCase, vital: VitalSign): Promise<void> {
  const db = getAnesthesiaLocalDb();
  const ts = nowIso();
  const localId = vital.id ?? `vital-${Date.now()}`;
  const vitalRow = mapVitalToRow(caseItem.id, { ...vital, id: localId }, 1);
  await db.vital_signs.put(vitalRow);

  const record = await db.records.get(caseItem.id);
  if (!record) return;
  try {
    const payload = JSON.parse(record.case_payload) as SurgeryCase;
    const index = payload.vitals.findIndex((item) => item.id === localId);
    const nextVital = { ...vital, id: localId };
    if (index >= 0) payload.vitals[index] = nextVital;
    else payload.vitals.push(nextVital);
    payload.vitals.sort((a, b) => a.time.localeCompare(b.time));
    await db.records.put({
      ...record,
      case_payload: JSON.stringify(payload),
      last_saved_at: ts,
      updated_at: ts,
    });
  } catch {
    // 仅写 vital_signs，不阻断设备采集
  }
}

export async function patchRecordDeviceCollectMeta(
  caseId: string,
  patch: {
    lastCollectTime?: string;
    collectStatus?: AnesthesiaRecordDeviceState['collectStatus'];
    monitor?: string;
    anesthesiaMachine?: string;
  },
): Promise<void> {
  const db = getAnesthesiaLocalDb();
  const record = await db.records.get(caseId);
  if (!record) return;
  try {
    const payload = JSON.parse(record.case_payload) as SurgeryCase;
    payload.device = {
      ...(payload.device ?? {
        monitor: '未连接',
        anesthesiaMachine: '未连接',
        infusionPump: '已连接',
        collectStatus: '未连接',
        dataSource: '',
        logs: [],
      }),
      ...patch,
      lastCollectTime: patch.lastCollectTime ?? payload.device?.lastCollectTime,
    };
    const ts = nowIso();
    await db.records.put({
      ...record,
      case_payload: JSON.stringify(payload),
      updated_at: ts,
      last_saved_at: ts,
    });
  } catch {
    // 设备元数据写入失败时不改内存态以外的数据
  }
}

export async function getLocalRecordMeta(caseId: string) {
  const db = getAnesthesiaLocalDb();
  return db.records.get(caseId);
}

export { SETTINGS_CURRENT_RECORD, SETTINGS_CURRENT_PAGE_PREFIX };
