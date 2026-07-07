export type SyncEntityType =
  | 'record'
  | 'snapshot'
  | 'timeline_event'
  | 'medication'
  | 'fluid'
  | 'transfusion'
  | 'vital_sign'
  | 'monitor_raw'
  | 'ventilator_raw'
  | 'io_record'
  | 'lab_result'
  | 'audit_log';

export type SyncOperationType = 'create' | 'update' | 'delete' | 'void' | 'lock' | 'print';

export type SyncQueueStatus = 'pending' | 'uploading' | 'success' | 'failed' | 'conflict';

export type SyncConflictType =
  | 'version_mismatch'
  | 'record_locked'
  | 'record_printed'
  | 'vital_corrected'
  | 'entity_conflict'
  | 'server_newer'
  | 'deleted_remote'
  | 'duplicate_time_point';

export type SyncConflictResolveStatus = 'pending' | 'resolved' | 'ignored';

export type SyncConflictResolveAction =
  | 'use_server'
  | 'keep_local_correction'
  | 'manual_merge'
  | 'ignore_local'
  | 'retry_sync';

/** 所有本地实体行共享的同步元数据字段 */
export interface LocalEntitySyncMeta {
  local_id: string;
  server_id?: number | null;
  sync_version: number;
  sync_status: SyncQueueStatus | 'local_only';
  updated_at: string;
  deleted_at?: string;
  void_reason?: string;
}

export interface LocalRecordRow extends LocalEntitySyncMeta {
  operation_id: string;
  surgery_id?: string;
  patient_id?: string;
  record_no?: string;
  record_status?: string;
  record_start_time?: string;
  record_end_time?: string;
  anesthesia_start_time?: string;
  anesthesia_end_time?: string;
  surgery_start_time?: string;
  surgery_end_time?: string;
  current_page: number;
  page_count?: number;
  printed_at?: string;
  locked_at?: string;
  last_saved_at: string;
  last_synced_at?: string;
  created_at: string;
  case_payload: string;
}

export interface LocalSnapshotRow extends LocalEntitySyncMeta {
  record_local_id: string;
  operation_id: string;
  snapshot_payload: string;
  created_at: string;
}

export interface LocalTimelineEventRow extends LocalEntitySyncMeta {
  record_local_id: string;
  record_server_id?: number | null;
  operation_id: string;
  event_time: string;
  event_type: string;
  event_code?: string;
  event_name: string;
  symbol?: string;
  display_row?: number;
  description?: string;
  source?: string;
  created_at: string;
  payload: string;
}

export interface LocalMedicationRow extends LocalEntitySyncMeta {
  record_local_id: string;
  record_server_id?: number | null;
  operation_id: string;
  drug_id?: string;
  drug_name: string;
  drug_category?: string;
  dose?: number;
  dose_unit?: string;
  route?: string;
  mode: string;
  is_special?: boolean;
  special_no?: number;
  special_category?: string;
  special_reason?: string;
  event_time?: string;
  rate?: string;
  rate_unit?: string;
  start_time?: string;
  end_time?: string;
  row_index?: number;
  display_text?: string;
  source?: string;
  created_at: string;
  payload: string;
}

export interface LocalFluidRow extends LocalEntitySyncMeta {
  record_local_id: string;
  record_server_id?: number | null;
  operation_id: string;
  fluid_type?: string;
  fluid_name: string;
  volume: number;
  volume_unit?: string;
  channel_type?: string;
  start_time?: string;
  end_time?: string;
  row_index?: number;
  is_count_input?: boolean;
  created_at: string;
  payload: string;
}

export interface LocalTransfusionRow extends LocalEntitySyncMeta {
  record_local_id: string;
  record_server_id?: number | null;
  operation_id: string;
  blood_product?: string;
  amount?: number;
  amount_unit?: string;
  volume: number;
  volume_unit?: string;
  channel_type?: string;
  start_time?: string;
  end_time?: string;
  row_index?: number;
  created_at: string;
  payload: string;
}

export interface LocalVitalSignRow extends LocalEntitySyncMeta {
  record_local_id: string;
  record_server_id?: number | null;
  operation_id: string;
  measure_time: string;
  sbp?: number;
  dbp?: number;
  map_value?: number;
  hr?: number;
  pulse?: number;
  spo2?: number;
  etco2?: number;
  bis?: number;
  temperature?: number;
  respiration?: number;
  airway_pressure?: number;
  cvp?: number;
  source?: string;
  source_device?: string;
  is_display_point: boolean;
  is_corrected: boolean;
  created_at: string;
  payload: string;
}

export interface LocalMonitorRawRow extends LocalEntitySyncMeta {
  record_local_id: string;
  record_server_id?: number | null;
  operation_id: string;
  collect_time: string;
  hr?: number;
  pulse?: number;
  sbp?: number;
  dbp?: number;
  map_value?: number;
  spo2?: number;
  temperature?: number;
  respiration?: number;
  bis?: number;
  source_device?: string;
  device_id?: string;
  raw_payload?: string;
  created_at: string;
}

export interface LocalVentilatorRawRow extends LocalEntitySyncMeta {
  record_local_id: string;
  record_server_id?: number | null;
  operation_id: string;
  collect_time: string;
  vent_mode?: string;
  tidal_volume?: number;
  respiratory_rate?: number;
  fio2?: number;
  peep?: number;
  peak_pressure?: number;
  plateau_pressure?: number;
  minute_volume?: number;
  etco2?: number;
  airway_pressure?: number;
  source_device?: string;
  device_id?: string;
  raw_payload?: string;
  created_at: string;
}

export interface LocalIoRecordRow extends LocalEntitySyncMeta {
  record_local_id: string;
  record_server_id?: number | null;
  operation_id: string;
  io_type?: string;
  volume?: number;
  measure_time?: string;
  created_at: string;
  payload: string;
}

export interface LocalLabResultRow extends LocalEntitySyncMeta {
  record_local_id: string;
  record_server_id?: number | null;
  operation_id: string;
  measure_time?: string;
  created_at: string;
  payload: string;
}

export interface LocalAuditLogRow {
  local_id: string;
  record_local_id: string;
  operation_id: string;
  action: string;
  detail?: string;
  operator?: string;
  created_at: string;
  payload: string;
}

export interface LocalSyncQueueRow {
  queue_id: string;
  batch_no?: string;
  record_local_id: string;
  record_server_id?: number | null;
  operation_id: string;
  entity_type: SyncEntityType;
  /** 与 entity_local_id 相同，满足队列字段规范 */
  local_id: string;
  entity_local_id: string;
  /** 与 entity_server_id 相同 */
  server_id?: number | null;
  entity_server_id?: number | null;
  operation_type: SyncOperationType;
  base_sync_version: number;
  api_path: string;
  payload: string;
  status: SyncQueueStatus;
  retry_count: number;
  last_error?: string;
  next_retry_at?: string;
  conflict_id?: string;
  created_at: string;
  updated_at: string;
}

export interface LocalSyncConflictRow {
  conflict_id: string;
  record_local_id: string;
  operation_id: string;
  entity_type: SyncEntityType;
  entity_local_id: string;
  entity_server_id?: number | null;
  queue_id?: string;
  conflict_type: SyncConflictType;
  local_payload: string;
  server_payload: string;
  local_sync_version: number;
  server_sync_version?: number;
  resolve_status: SyncConflictResolveStatus;
  resolve_action?: SyncConflictResolveAction;
  resolve_note?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

export interface LocalSettingsRow {
  key: string;
  value: string;
  updated_at: string;
}

export interface RecordPersistMeta {
  entityType?: SyncEntityType;
  entityLocalId?: string;
  operationType?: SyncOperationType;
  apiPath?: string;
  payload?: unknown;
  skipQueue?: boolean;
  baseSyncVersion?: number;
  voidReason?: string;
}

export interface AnesthesiaSyncState {
  pendingCount: number;
  failedCount: number;
  conflictCount: number;
  uploading: boolean;
  lastSyncSuccessAt?: string;
  lastSyncError?: string;
  online: boolean;
  monitorRunning: boolean;
  ventilatorRunning: boolean;
  lastCollectTime?: string;
  rescueMode: boolean;
  localSavedAt?: string;
}

export const CONFLICT_ENTITY_TYPES = new Set<SyncEntityType>([
  'medication',
  'fluid',
  'transfusion',
  'timeline_event',
]);

export const DEVICE_RAW_ENTITY_TYPES = new Set<SyncEntityType>(['monitor_raw', 'ventilator_raw']);

export const KEY_EVENT_TYPES = new Set(['抢救', '插管', '拔管', '非计划转ICU', '心脏骤停']);
