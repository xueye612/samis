import type { PushBatchItem } from '@/api/anesthesiaSync';
import { buildCasePayload } from '@/services/anesthesia/casePayload';
import { getAnesthesiaLocalDb } from '@/services/anesthesia/localDb';
import type {
  LocalFluidRow,
  LocalIoRecordRow,
  LocalLabResultRow,
  LocalMedicationRow,
  LocalRecordRow,
  LocalSnapshotRow,
  LocalStructuredRecordRow,
  LocalSyncQueueRow,
  LocalTimelineEventRow,
  LocalTransfusionRow,
  LocalVitalSignRow,
  SyncEntityType,
} from '@/types/anesthesiaLocalDb';
import type { SurgeryCase } from '@/types/anesthesia';

type AnyRecord = Record<string, unknown>;

function parseObject(value?: string | null): AnyRecord {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as AnyRecord : {};
  } catch {
    return {};
  }
}

function cleanObject<T extends AnyRecord>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

async function readRecordCase(recordLocalId: string): Promise<SurgeryCase | null> {
  const record = await getAnesthesiaLocalDb().records.get(recordLocalId);
  const parsed = parseObject(record?.case_payload);
  return Object.keys(parsed).length ? parsed as unknown as SurgeryCase : null;
}

function findEntityInCase(caseItem: SurgeryCase | null, entityType: SyncEntityType, localId: string): AnyRecord {
  if (!caseItem) return {};
  const collections: Partial<Record<SyncEntityType, unknown[] | undefined>> = {
    timeline_event: caseItem.events,
    medication: caseItem.medications,
    fluid: caseItem.fluids?.filter((item) => item.category !== '血液制品'),
    transfusion: caseItem.fluids?.filter((item) => item.category === '血液制品'),
    vital_sign: caseItem.vitals,
    io_record: caseItem.outputRecords,
    lab_result: caseItem.labResults,
  };
  const found = collections[entityType]?.find((item) => {
    return Boolean(item && typeof item === 'object' && (item as { id?: string }).id === localId);
  });
  return found && typeof found === 'object' ? found as AnyRecord : {};
}

function commonPayload(queueItem: LocalSyncQueueRow, source: AnyRecord = {}): AnyRecord {
  return cleanObject({
    ...source,
    localId: queueItem.local_id,
    serverId: queueItem.server_id ?? null,
    baseSyncVersion: queueItem.base_sync_version,
    syncVersion: queueItem.base_sync_version,
  });
}

function mapRecordPayload(queueItem: LocalSyncQueueRow, row: LocalRecordRow | undefined, queued: AnyRecord, caseItem: SurgeryCase | null): AnyRecord {
  const payloadCase = (queued.casePayload && typeof queued.casePayload === 'object')
    ? queued.casePayload
    : caseItem ? buildCasePayload(caseItem) : undefined;
  return commonPayload(queueItem, cleanObject({
    recordStatus: row?.record_status ?? queued.recordStatus,
    patientId: row?.patient_id ?? queued.patientId,
    recordStartTime: row?.record_start_time ?? queued.recordStartTime,
    recordEndTime: row?.record_end_time ?? queued.recordEndTime,
    pageCount: row?.page_count ?? queued.pageCount,
    currentPage: row?.current_page ?? queued.currentPage,
    recordLocked: queued.recordLocked ?? Boolean(row?.locked_at),
    recordPrinted: queued.recordPrinted ?? Boolean(row?.printed_at),
    lockedAt: row?.locked_at ?? queued.lockedAt,
    printedAt: row?.printed_at ?? queued.printedAt,
    voidReason: queued.voidReason,
    casePayload: payloadCase,
  }));
}

function mapSnapshotPayload(queueItem: LocalSyncQueueRow, row: LocalSnapshotRow | undefined, queued: AnyRecord): AnyRecord {
  const snapshot = parseObject(row?.snapshot_payload);
  return commonPayload(queueItem, cleanObject({
    snapshotAt: queued.snapshotAt ?? row?.updated_at ?? row?.created_at,
    snapshotReason: queued.snapshotReason ?? queued.reason ?? (queueItem.operation_type === 'print' ? 'print' : undefined),
    printedAt: queued.printedAt,
    operator: queued.operator,
    immutable: queued.immutable ?? queueItem.operation_type === 'print',
    snapshot: queued.snapshot ?? snapshot,
    patient: queued.patient,
    operation: queued.operation,
  }));
}

function mapTimelinePayload(queueItem: LocalSyncQueueRow, row: LocalTimelineEventRow | undefined, raw: AnyRecord): AnyRecord {
  return commonPayload(queueItem, cleanObject({
    eventType: row?.event_type ?? raw.eventType ?? raw.type,
    eventCode: row?.event_code ?? raw.eventCode,
    eventName: row?.event_name ?? raw.eventName ?? raw.type,
    eventTime: row?.event_time ?? raw.eventTime ?? raw.time,
    stage: raw.stage,
    severity: raw.severity,
    description: row?.description ?? raw.description ?? raw.treatment,
    treatment: raw.treatment,
    symbol: row?.symbol ?? raw.symbol,
    displayRow: row?.display_row ?? raw.displayRow,
    source: row?.source ?? raw.source ?? 'manual',
    status: raw.status,
  }));
}

function mapMedicationPayload(queueItem: LocalSyncQueueRow, row: LocalMedicationRow | undefined, raw: AnyRecord): AnyRecord {
  return commonPayload(queueItem, cleanObject({
    drugName: row?.drug_name ?? raw.drugName ?? raw.drug,
    drugCode: row?.drug_id ?? raw.drugCode,
    drugCategory: row?.drug_category ?? raw.drugCategory,
    dose: row?.dose ?? raw.dose,
    doseUnit: row?.dose_unit ?? raw.doseUnit ?? raw.unit,
    route: row?.route ?? raw.route,
    mode: row?.mode ?? raw.mode,
    rate: row?.rate ?? raw.rate ?? raw.pumpRate,
    rateUnit: row?.rate_unit ?? raw.rateUnit,
    eventTime: row?.event_time ?? raw.eventTime ?? raw.time,
    startTime: row?.start_time ?? raw.startTime ?? raw.time,
    endTime: row?.end_time ?? raw.endTime ?? raw.stopTime,
    rowIndex: row?.row_index ?? raw.rowIndex,
    displayText: row?.display_text ?? raw.displayText,
    executor: raw.executor,
    isSpecial: row?.is_special ?? raw.isSpecial,
    specialNo: row?.special_no ?? raw.specialNo,
    specialCategory: row?.special_category ?? raw.specialCategory,
    specialReason: row?.special_reason ?? raw.specialReason ?? raw.reason,
    source: row?.source ?? raw.source ?? 'manual',
    status: raw.status,
    remark: raw.remark,
  }));
}

function mapFluidPayload(queueItem: LocalSyncQueueRow, row: LocalFluidRow | undefined, raw: AnyRecord): AnyRecord {
  return commonPayload(queueItem, cleanObject({
    fluidName: row?.fluid_name ?? raw.fluidName ?? raw.name,
    fluidCode: raw.fluidCode ?? raw.code,
    category: row?.fluid_type ?? raw.category,
    subCategory: raw.subCategory,
    unit: row?.volume_unit ?? raw.unit,
    volume: row?.volume ?? raw.volume,
    startTime: row?.start_time ?? raw.startTime,
    endTime: row?.end_time ?? raw.endTime,
    isCountInput: row?.is_count_input ?? raw.isCountInput,
    source: raw.source ?? 'manual',
    remark: raw.remark,
  }));
}

function mapTransfusionPayload(queueItem: LocalSyncQueueRow, row: LocalTransfusionRow | undefined, raw: AnyRecord): AnyRecord {
  return commonPayload(queueItem, cleanObject({
    productName: row?.blood_product ?? raw.productName ?? raw.product ?? raw.name,
    productCode: raw.productCode ?? raw.code,
    volume: row?.volume ?? row?.amount ?? raw.volume,
    unit: row?.volume_unit ?? row?.amount_unit ?? raw.unit,
    startTime: row?.start_time ?? raw.startTime,
    endTime: row?.end_time ?? raw.endTime,
    doubleCheck: raw.doubleCheck,
    reaction: raw.reaction,
    bagCount: raw.bagCount,
    source: raw.source ?? 'manual',
    remark: raw.remark,
  }));
}

function mapVitalPayload(queueItem: LocalSyncQueueRow, row: LocalVitalSignRow | undefined, raw: AnyRecord): AnyRecord {
  return commonPayload(queueItem, cleanObject({
    measureTime: row?.measure_time ?? raw.measureTime ?? raw.time,
    HR: row?.hr ?? raw.HR,
    SBP: row?.sbp ?? raw.SBP,
    DBP: row?.dbp ?? raw.DBP,
    MAP: row?.map_value ?? raw.MAP,
    SpO2: row?.spo2 ?? raw.SpO2,
    EtCO2: row?.etco2 ?? raw.EtCO2,
    BIS: row?.bis ?? raw.BIS,
    TEMP: row?.temperature ?? raw.TEMP,
    RR: row?.respiration ?? raw.RR,
    CVP: row?.cvp ?? raw.CVP,
    source: row?.source ?? raw.source,
    sourceDevice: row?.source_device ?? raw.sourceDevice,
    isDisplayPoint: row?.is_display_point ?? raw.isDisplayPoint ?? raw.status !== 'voided',
    isCorrected: row?.is_corrected ?? raw.isCorrected ?? raw.source === '手工修正',
    correctedValue: raw.correctedValue,
    displayRow: raw.displayRow,
  }));
}

function mapIoPayload(queueItem: LocalSyncQueueRow, row: LocalIoRecordRow | undefined, raw: AnyRecord): AnyRecord {
  return commonPayload(queueItem, cleanObject({
    ioType: row?.io_type ?? raw.ioType ?? raw.type,
    volume: row?.volume ?? raw.volume,
    unit: raw.unit,
    measureTime: row?.measure_time ?? raw.measureTime ?? raw.time,
    source: raw.source ?? 'manual',
    remark: raw.remark,
  }));
}

function mapLabPayload(queueItem: LocalSyncQueueRow, row: LocalLabResultRow | undefined, raw: AnyRecord): AnyRecord {
  const firstItem = Array.isArray(raw.items) && raw.items[0] && typeof raw.items[0] === 'object'
    ? raw.items[0] as AnyRecord
    : {};
  return commonPayload(queueItem, cleanObject({
    itemName: raw.itemName ?? firstItem.name ?? raw.labType,
    itemCode: raw.itemCode ?? firstItem.code,
    value: raw.value ?? firstItem.value,
    unit: raw.unit ?? firstItem.unit,
    refRange: raw.refRange ?? firstItem.normalRange,
    abnormalFlag: raw.abnormalFlag ?? firstItem.abnormal,
    measureTime: row?.measure_time ?? raw.measureTime ?? raw.resultTime,
    source: raw.source ?? 'manual',
    remark: raw.remark,
  }));
}

function mapStructuredPayload(queueItem: LocalSyncQueueRow, row: LocalStructuredRecordRow | undefined, queued: AnyRecord): AnyRecord {
  return commonPayload(queueItem, cleanObject({
    ...parseObject(row?.payload),
    ...queued,
    occurredAt: queued.occurredAt ?? row?.occurred_at,
    voidReason: queued.voidReason ?? row?.void_reason,
  }));
}

export async function mapSyncQueueRowToPushBatchItem(queueItem: LocalSyncQueueRow): Promise<PushBatchItem> {
  const db = getAnesthesiaLocalDb();
  const queued = parseObject(queueItem.payload);
  const caseItem = await readRecordCase(queueItem.record_local_id);
  const fallback = findEntityInCase(caseItem, queueItem.entity_type, queueItem.local_id);
  let payload: AnyRecord = commonPayload(queueItem, { ...fallback, ...queued });

  if (queueItem.entity_type === 'record') {
    payload = mapRecordPayload(queueItem, await db.records.get(queueItem.local_id), queued, caseItem);
  } else if (queueItem.entity_type === 'snapshot') {
    payload = mapSnapshotPayload(queueItem, await db.snapshots.get(queueItem.local_id), { ...fallback, ...queued });
  } else if (queueItem.entity_type === 'timeline_event') {
    const row = await db.timeline_events.get(queueItem.local_id);
    payload = mapTimelinePayload(queueItem, row, { ...fallback, ...parseObject(row?.payload), ...queued });
  } else if (queueItem.entity_type === 'medication') {
    const row = await db.medications.get(queueItem.local_id);
    payload = mapMedicationPayload(queueItem, row, { ...fallback, ...parseObject(row?.payload), ...queued });
  } else if (queueItem.entity_type === 'fluid') {
    const row = await db.fluids.get(queueItem.local_id);
    payload = mapFluidPayload(queueItem, row, { ...fallback, ...parseObject(row?.payload), ...queued });
  } else if (queueItem.entity_type === 'transfusion') {
    const row = await db.transfusions.get(queueItem.local_id);
    payload = mapTransfusionPayload(queueItem, row, { ...fallback, ...parseObject(row?.payload), ...queued });
  } else if (queueItem.entity_type === 'vital_sign') {
    const row = await db.vital_signs.get(queueItem.local_id);
    payload = mapVitalPayload(queueItem, row, { ...fallback, ...parseObject(row?.payload), ...queued });
  } else if (queueItem.entity_type === 'io_record') {
    const row = await db.io_records.get(queueItem.local_id);
    payload = mapIoPayload(queueItem, row, { ...fallback, ...parseObject(row?.payload), ...queued });
  } else if (queueItem.entity_type === 'lab_result') {
    const row = await db.lab_results.get(queueItem.local_id);
    payload = mapLabPayload(queueItem, row, { ...fallback, ...parseObject(row?.payload), ...queued });
  } else {
    const tableMap = {
      airway_record: db.airway_records,
      ventilation_segment: db.ventilation_segments,
      infusion_segment: db.infusion_segments,
      transfusion_verification: db.transfusion_verifications,
      rescue_event: db.rescue_events,
      rescue_action: db.rescue_actions,
    } as const;
    const table = tableMap[queueItem.entity_type as keyof typeof tableMap];
    if (table) {
      payload = mapStructuredPayload(queueItem, await table.get(queueItem.local_id), queued);
    }
  }

  return {
    entityType: queueItem.entity_type,
    operationType: queueItem.operation_type,
    localId: queueItem.local_id,
    serverId: queueItem.server_id,
    baseSyncVersion: queueItem.base_sync_version,
    apiPath: queueItem.api_path,
    payload,
  };
}

export async function mapSyncQueueRowsToPushBatchItems(queueItems: LocalSyncQueueRow[]): Promise<PushBatchItem[]> {
  return Promise.all(queueItems.map((item) => mapSyncQueueRowToPushBatchItem(item)));
}
