import type { SurgeryCase } from '@/types/anesthesia';

/**
 * Slice 3f —— 列表字段（已由关系子表承载的 sync 实体）。
 * 这些数组不进 casePayload，避免与服务端关系子表形成双重真值。
 *
 * 子表对应关系（见 anesthesiaRecordRepository.saveCaseToLocalDb）：
 * - vitals       → vital_sign 表
 * - events       → timeline_event 表
 * - medications  → medication 表
 * - fluids       → fluid 表（非血液制品）+ transfusion 表（血液制品，同源 fluids 数组）
 * - outputRecords→ io_record 表（出入量明细）
 * - labResults   → lab_results 表
 *
 * 注意（保留在 casePayload，无专属子表）：
 * - `outputs`（汇总对象，非明细）；
 * - `transfusionEvents`（TransfusionEventRecord[]，与 transfusion 表不同源）；
 * - `ioRecords`（IoRecordEntry[]，与 io_record 表不同源）；
 * - `anesthesiaPlanes` / `modificationLogs` 等。
 */
export const CASE_LIST_FIELDS = [
  'vitals',
  'events',
  'medications',
  'fluids',
  'outputRecords',
  'labResults',
] as const;

/**
 * 从 SurgeryCase 构造 case 级非列表 payload（剥离列表数组后的浅拷贝）。
 * 用于 record sync item 的 casePayload 字段，以及服务端回读重建时作为 case 级基础。
 */
export function buildCasePayload(caseItem: SurgeryCase): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...caseItem };
  for (const key of CASE_LIST_FIELDS) {
    delete payload[key];
  }
  return payload;
}

/**
 * 判定某字段是否为已剥离的列表字段。
 */
export function isCaseListField(key: string): boolean {
  return (CASE_LIST_FIELDS as readonly string[]).includes(key);
}
