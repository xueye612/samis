import Dexie, { type Table } from 'dexie';
import type {
  LocalAuditLogRow,
  LocalFluidRow,
  LocalIoRecordRow,
  LocalLabResultRow,
  LocalMedicationRow,
  LocalMonitorRawRow,
  LocalRecordRow,
  LocalSettingsRow,
  LocalSnapshotRow,
  LocalSyncConflictRow,
  LocalSyncQueueRow,
  LocalTimelineEventRow,
  LocalTransfusionRow,
  LocalVentilatorRawRow,
  LocalVitalSignRow,
} from '@/types/anesthesiaLocalDb';

export const ANESTHESIA_LOCAL_DB_NAME = 'samis_anesthesia_local_v1';

export class AnesthesiaLocalDatabase extends Dexie {
  records!: Table<LocalRecordRow, string>;
  snapshots!: Table<LocalSnapshotRow, string>;
  timeline_events!: Table<LocalTimelineEventRow, string>;
  medications!: Table<LocalMedicationRow, string>;
  fluids!: Table<LocalFluidRow, string>;
  transfusions!: Table<LocalTransfusionRow, string>;
  vital_signs!: Table<LocalVitalSignRow, string>;
  monitor_raw!: Table<LocalMonitorRawRow, string>;
  ventilator_raw!: Table<LocalVentilatorRawRow, string>;
  io_records!: Table<LocalIoRecordRow, string>;
  lab_results!: Table<LocalLabResultRow, string>;
  audit_logs!: Table<LocalAuditLogRow, string>;
  sync_queue!: Table<LocalSyncQueueRow, string>;
  sync_conflicts!: Table<LocalSyncConflictRow, string>;
  settings!: Table<LocalSettingsRow, string>;

  constructor() {
    super(ANESTHESIA_LOCAL_DB_NAME);
    this.version(1).stores({
      records: 'local_id, operation_id, server_id, updated_at',
      snapshots: 'local_id, record_local_id, operation_id',
      timeline_events: 'local_id, record_local_id, operation_id, event_time',
      medications: 'local_id, record_local_id, operation_id, start_time',
      fluids: 'local_id, record_local_id, operation_id, start_time',
      transfusions: 'local_id, record_local_id, operation_id, start_time',
      vital_signs: 'local_id, record_local_id, operation_id, measure_time, is_display_point',
      monitor_raw: 'local_id, record_local_id, operation_id, collect_time',
      ventilator_raw: 'local_id, record_local_id, operation_id, collect_time',
      io_records: 'local_id, record_local_id, operation_id',
      lab_results: 'local_id, record_local_id, operation_id',
      audit_logs: 'local_id, record_local_id, operation_id, created_at',
      sync_queue: 'queue_id, record_local_id, operation_id, status, entity_type, next_retry_at, created_at, conflict_id',
      sync_conflicts: 'conflict_id, record_local_id, operation_id, entity_type, resolve_status, created_at',
      settings: 'key',
    });
  }
}

let dbInstance: AnesthesiaLocalDatabase | undefined;

export function getAnesthesiaLocalDb(): AnesthesiaLocalDatabase {
  if (!dbInstance) {
    dbInstance = new AnesthesiaLocalDatabase();
  }
  return dbInstance;
}

export async function resetAnesthesiaLocalDbForTests() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = undefined;
  }
  await Dexie.delete(ANESTHESIA_LOCAL_DB_NAME);
}
