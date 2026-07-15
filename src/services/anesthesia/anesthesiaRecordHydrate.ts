import { Message } from '@arco-design/web-vue';
import type {
  AnesthesiaEvent,
  FluidRecord,
  MedicationRecord,
  OutputDetailRecord,
  SurgeryCase,
  VitalSign,
} from '@/types/anesthesia';
import type {
  IoRecordEntry,
  LabResultRecord,
  TransfusionEventRecord,
} from '@/types/anesthesiaRecord';
import { anesthesiaRecordApi } from '@/api/anesthesiaSync';
import { emptyClinicalShell } from '@/services/anesthesia/adapters/operationInfoAdapter';
import { persistCaseNow } from '@/services/anesthesia/anesthesiaPersistenceBridge';
import { loadCaseFromLocalDb } from '@/services/anesthesia/anesthesiaRecordRepository';
import { useRealAnesthesiaRecord } from '@/config/apiFlags';

/**
 * Slice 3f —— 服务端记录回读：getRecordDetail 聚合响应 → 重建 SurgeryCase。
 *
 * 用途：
 * - 冷启动：本地 IndexedDB 无该 operationId 的 case 时，从服务端拉取并 seed 本地。
 * - 手动“从服务端重载”：强制拉取并覆盖本地（带二次确认；锁定态只读展示）。
 *
 * 不含 device raw（monitor_raw/ventilator_raw 高频追溯数据）。
 */

const VOID_STATUSES = new Set(['voided', 'deleted']);

function isActiveStatus(status: unknown): boolean {
  return typeof status === 'string' && !VOID_STATUSES.has(status);
}

function str(v: unknown): string | undefined {
  return v === null || v === undefined || v === '' ? undefined : String(v);
}

function num(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** getRecordDetail 聚合返回的 record 形状（与后端 AnesRecordService 对齐）。 */
export interface RecordDetailRecord {
  localId?: string;
  serverId?: string;
  recordStatus?: string;
  syncVersion?: number;
  recordLocked?: boolean;
  recordPrinted?: boolean;
  anesthesiaMethod?: string;
  casePayload: Record<string, unknown> | null;
  medications: RecordDetailMedication[];
  timelineEvents: RecordDetailTimelineEvent[];
  vitalSigns: RecordDetailVitalGroup[];
  fluids: RecordDetailFluid[];
  transfusions: RecordDetailTransfusion[];
  ioRecords: RecordDetailIo[];
  labResults: RecordDetailLab[];
  airwayRecords?: RecordDetailStructuredEntity[];
  ventilationSegments?: RecordDetailStructuredEntity[];
  infusionSegments?: RecordDetailStructuredEntity[];
  transfusionVerifications?: RecordDetailStructuredEntity[];
  rescueEvents?: RecordDetailStructuredEntity[];
  rescueActions?: RecordDetailStructuredEntity[];
}

export interface RecordDetailResponse {
  operationId: string;
  record: RecordDetailRecord | null;
}

export interface RecordDetailMedication {
  localId?: string; drugName?: string; drugCategory?: string; dose?: unknown;
  doseUnit?: string; route?: string; mode?: string; rate?: string; rateUnit?: string;
  concentration?: string; eventTime?: string; startTime?: string; endTime?: string;
  rowIndex?: number; displayText?: string; executor?: string; isSpecial?: boolean;
  specialNo?: number; specialCategory?: string; specialReason?: string; status?: string;
}
export interface RecordDetailTimelineEvent {
  localId?: string; eventType?: string; eventName?: string; eventTime?: string;
  stage?: string; severity?: string; description?: string; treatment?: string; status?: string;
}
export interface RecordDetailVitalGroup {
  localId?: string; time?: string; source?: string; isCorrected?: boolean;
  HR?: number; SBP?: number; DBP?: number; MAP?: number; SpO2?: number;
  RR?: number; EtCO2?: number; TEMP?: number; BIS?: number; CVP?: number;
}
export interface RecordDetailFluid {
  localId?: string; fluidName?: string; category?: string; unit?: string;
  volume?: unknown; startTime?: string; endTime?: string; status?: string;
}
export interface RecordDetailTransfusion {
  localId?: string; productName?: string; volume?: unknown; unit?: string;
  startTime?: string; endTime?: string; reaction?: string; bagCount?: number; status?: string;
}
export interface RecordDetailIo {
  localId?: string; ioType?: string; volume?: unknown; unit?: string;
  measureTime?: string; remark?: string; status?: string;
}
export interface RecordDetailLab {
  localId?: string; itemName?: string; itemCode?: string; value?: string; unit?: string;
  measureTime?: string; abnormalFlag?: string; refRange?: string; status?: string;
}
export interface RecordDetailStructuredEntity {
  localId?: string;
  status?: string;
  occurredAt?: string;
  triggeredAt?: string;
  action?: string;
  actionType?: string;
  level?: string;
  outcome?: string;
  triggerDescription?: string;
}

const MED_MODE_REVERSE: Record<string, MedicationRecord['mode']> = {
  single: '单次用药',
  continuous: '持续泵入',
  intermittent: '间断追加',
};

function mapMedication(m: RecordDetailMedication): MedicationRecord {
  const localId = str(m.localId) ?? `med-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id: localId,
    drug: str(m.drugName) ?? '',
    drugCategory: str(m.drugCategory),
    dose: num(m.dose),
    unit: str(m.doseUnit),
    route: str(m.route),
    mode: (m.mode && MED_MODE_REVERSE[m.mode]) || '单次用药',
    pumpRate: str(m.rate),
    rateUnit: str(m.rateUnit),
    concentration: str(m.concentration),
    eventTime: str(m.eventTime),
    time: str(m.eventTime) ?? str(m.startTime),
    startTime: str(m.startTime),
    endTime: str(m.endTime),
    rowIndex: m.rowIndex,
    displayText: str(m.displayText),
    executor: str(m.executor) ?? '',
    isSpecial: Boolean(m.isSpecial),
    specialNo: m.specialNo,
    specialCategory: m.specialCategory as MedicationRecord['specialCategory'],
    specialReason: str(m.specialReason),
    status: isActiveStatus(m.status) ? 'active' : 'voided',
  };
}

function mapTimelineEvent(e: RecordDetailTimelineEvent): AnesthesiaEvent {
  const localId = str(e.localId) ?? `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id: localId,
    type: str(e.eventType) ?? str(e.eventName) ?? '',
    time: str(e.eventTime) ?? '',
    stage: (str(e.stage) as AnesthesiaEvent['stage']) ?? '术中',
    severity: (str(e.severity) as AnesthesiaEvent['severity']) ?? '轻度',
    treatment: str(e.description) ?? str(e.treatment) ?? '',
    staff: [],
    reported: false,
    qualityIncluded: false,
    status: isActiveStatus(e.status) ? 'active' : 'voided',
  };
}

function mapVitalGroup(v: RecordDetailVitalGroup): VitalSign {
  const localId = str(v.localId) ?? `vital-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id: localId,
    time: str(v.time) ?? '',
    HR: v.HR,
    SBP: v.SBP,
    DBP: v.DBP,
    MAP: v.MAP,
    SpO2: v.SpO2,
    RR: v.RR,
    EtCO2: v.EtCO2,
    TEMP: v.TEMP,
    BIS: v.BIS,
    CVP: v.CVP,
    source: v.isCorrected ? '手工修正' : (str(v.source) as VitalSign['source']),
    status: 'active',
  };
}

function mapFluid(f: RecordDetailFluid): FluidRecord {
  const localId = str(f.localId) ?? `fluid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const category = (str(f.category) as FluidRecord['category']) ?? '晶体液';
  return {
    id: localId,
    category,
    name: str(f.fluidName) ?? '',
    startTime: str(f.startTime) ?? '',
    endTime: str(f.endTime),
    volume: num(f.volume) ?? 0,
    unit: str(f.unit) ?? 'ml',
    executor: '',
    status: isActiveStatus(f.status) ? 'active' : 'voided',
  };
}

/** 输血行回读为血液制品 FluidRecord（与本地保存时 blood→transfusion 表互逆）。 */
function mapTransfusionToFluid(t: RecordDetailTransfusion): FluidRecord {
  const localId = str(t.localId) ?? `trans-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id: localId,
    category: '血液制品',
    name: str(t.productName) ?? '',
    product: str(t.productName) ?? undefined,
    startTime: str(t.startTime) ?? '',
    endTime: str(t.endTime),
    volume: num(t.volume) ?? 0,
    unit: str(t.unit) ?? 'ml',
    reaction: str(t.reaction),
    bagNo: t.bagCount ? String(t.bagCount) : undefined,
    doubleCheck: true,
    executor: '',
    status: isActiveStatus(t.status) ? 'active' : 'voided',
  };
}

const OUTPUT_TYPE_SET = new Set(['尿量', '出血量', '引流量', '其他']);

function mapIoToOutput(io: RecordDetailIo): OutputDetailRecord | null {
  const type = str(io.ioType);
  if (!type || !OUTPUT_TYPE_SET.has(type)) return null;
  const localId = str(io.localId) ?? `out-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id: localId,
    time: str(io.measureTime) ?? '',
    type: type as OutputDetailRecord['type'],
    volume: num(io.volume) ?? 0,
    remark: str(io.remark),
    status: isActiveStatus(io.status) ? 'active' : 'voided',
  };
}

function mapLab(l: RecordDetailLab): LabResultRecord | null {
  if (!l.itemName && !l.value) return null;
  const localId = str(l.localId) ?? `lab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const abnormalFlag = str(l.abnormalFlag);
  return {
    id: localId,
    resultTime: str(l.measureTime) ?? '',
    labType: '常规',
    items: [{
      code: str(l.itemCode) ?? str(l.itemName) ?? '',
      name: str(l.itemName) ?? '',
      value: str(l.value) ?? '',
      unit: str(l.unit) ?? '',
      normalRange: str(l.refRange),
      abnormal: abnormalFlag ? abnormalFlag !== '正常' && abnormalFlag.toLowerCase() !== 'normal' : undefined,
    }],
    displayMode: 'full',
    source: 'import',
    status: isActiveStatus(l.status) ? 'active' : 'voided',
  };
}

/**
 * 由 getRecordDetail 聚合响应重建 SurgeryCase。
 * @param detail  服务端聚合 record
 * @param seedCase operationInfo 兜底表头（R6：历史无 casePayload 时表头来源）
 */
export function reconstructCaseFromRecordDetail(
  detail: RecordDetailRecord,
  seedCase?: SurgeryCase | null,
): SurgeryCase {
  const casePayload = detail.casePayload ?? {};
  // 顺序：默认壳 → operationInfo 表头兜底 → casePayload（临床态）→ 元数据
  const merged: SurgeryCase = {
    ...emptyClinicalShell(String(casePayload.id ?? seedCase?.id ?? '')),
    ...(seedCase ?? {}),
    ...(casePayload as Partial<SurgeryCase>),
  };

  // 列表来自关系子表聚合
  merged.vitals = (detail.vitalSigns ?? []).map(mapVitalGroup);
  merged.events = (detail.timelineEvents ?? []).map(mapTimelineEvent);
  merged.medications = (detail.medications ?? []).map(mapMedication);
  const fluids: FluidRecord[] = (detail.fluids ?? []).map(mapFluid);
  const bloodFluids: FluidRecord[] = (detail.transfusions ?? []).map(mapTransfusionToFluid);
  merged.fluids = [...fluids, ...bloodFluids];
  merged.outputRecords = (detail.ioRecords ?? [])
    .map(mapIoToOutput)
    .filter((r): r is OutputDetailRecord => r !== null);
  const labs = (detail.labResults ?? [])
    .map(mapLab)
    .filter((r): r is LabResultRecord => r !== null);
  if (labs.length) merged.labResults = labs;

  // 元数据覆盖（服务端权威）
  if (detail.recordStatus) merged.recordStatus = detail.recordStatus as SurgeryCase['recordStatus'];
  if (typeof detail.recordLocked === 'boolean') merged.locked = detail.recordLocked;
  if (detail.recordPrinted) merged.printedAt = merged.printedAt ?? new Date().toISOString();
  if (detail.anesthesiaMethod) merged.anesthesiaMethod = detail.anesthesiaMethod;
  merged.vitals.sort((a, b) => a.time.localeCompare(b.time));

  // 兜底：确保 outputs 存在
  if (!merged.outputs) merged.outputs = { urine: 0, bloodLoss: 0, drainage: 0 };

  // 兼容类型：transfusionEvents/ioRecords（无子表）已由 casePayload 携带，类型对齐
  merged.transfusionEvents = (merged.transfusionEvents ?? []) as TransfusionEventRecord[];
  merged.ioRecords = (merged.ioRecords ?? []) as IoRecordEntry[];

  return merged;
}

/** 调用 getRecordDetail 并返回结构化结果。 */
export async function fetchRecordDetail(operationId: string): Promise<RecordDetailResponse> {
  const raw = await anesthesiaRecordApi.getRecordDetail({ operationId }) as RecordDetailResponse;
  return raw;
}

/**
 * 冷启动回读：若本地 IndexedDB 无该 operationId 的 case，则从服务端拉取重建并 seed 本地。
 * 本地已有 → 直接返回本地（不覆盖）。
 * 非真实记录模式（!useRealAnesthesiaRecord）→ 不发起请求，返回 null。
 *
 * @returns 重建后的 SurgeryCase，或 null（无服务端记录 / 非真实模式）。
 */
export async function hydrateCaseFromServer(
  operationId: string,
  seedCase?: SurgeryCase | null,
): Promise<SurgeryCase | null> {
  if (!useRealAnesthesiaRecord()) return null;
  const local = await loadCaseFromLocalDb(operationId);
  if (local) return local;

  let detail: RecordDetailResponse;
  try {
    detail = await fetchRecordDetail(operationId);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '从服务端回读记录失败';
    Message.warning(msg);
    return null;
  }
  if (!detail.record) return null;

  const reconstructed = reconstructCaseFromRecordDetail(detail.record, seedCase);
  // seed 本地 IndexedDB（skipQueue 避免触发回写循环；冷启动仅落本地）
  await persistCaseNow(reconstructed, undefined, { skipQueue: true });
  return reconstructed;
}

/**
 * 手动“从服务端重载”：强制拉取并覆盖本地。
 * 锁定态记录回读为只读展示（reconstructed.locked=true），调用方据此禁止编辑。
 *
 * @returns 重建后的 SurgeryCase，或 null（无服务端记录）。
 */
export async function reloadCaseFromServer(
  operationId: string,
  seedCase?: SurgeryCase | null,
): Promise<SurgeryCase | null> {
  if (!useRealAnesthesiaRecord()) return null;
  let detail: RecordDetailResponse;
  try {
    detail = await fetchRecordDetail(operationId);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '从服务端重载失败';
    Message.warning(msg);
    return null;
  }
  if (!detail.record) return null;

  const reconstructed = reconstructCaseFromRecordDetail(detail.record, seedCase);
  await persistCaseNow(reconstructed, undefined, { skipQueue: true });
  return reconstructed;
}
