import { operationInfoApi } from '@/api/operationInfo';
import { authApi } from '@/api/auth';
import { SamisHttpError } from '@/api/samisHttpClient';
import type { SurgeryCase } from '@/types/anesthesia';
import {
  mapOperationListItem,
  mergeRemoteMasterWithLocalClinical,
} from '@/services/anesthesia/adapters/operationInfoAdapter';
import {
  buildMasterDataUpdateEnvelope,
  type MasterDataChange,
} from '@/services/anesthesia/scheduleService';

export const MASTER_DATA_PERMISSION = 'operation.master_data.update';
export const MASTER_DATA_CONFLICT_CODE = 4091;

export type MasterDataAuditResult = 'pending' | 'success' | 'failure';

export interface MasterDataAuditEntry {
  field: string;
  label?: string;
  before: unknown;
  after: unknown;
  reason?: string;
  actorId?: string;
  actorRole?: string;
  occurredAt?: string;
  result?: MasterDataAuditResult;
}

/** 审计状态中文标签：pending 不得显示成普通成功记录。 */
export function auditResultLabel(result: string | undefined): string {
  if (result === 'pending') return '审计待确认';
  if (result === 'success') return '成功';
  if (result === 'failure') return '失败';
  return '—';
}

export class MasterDataConflictError extends Error {
  constructor(message = '数据已被其他人修改，请刷新后重试') {
    super(message);
    this.name = 'MasterDataConflictError';
  }
}

/** 无手术主数据修改权限时抛出；页面据此阻止任何写请求。 */
export class MasterDataPermissionError extends Error {
  constructor(message = '无手术主数据修改权限') {
    super(message);
    this.name = 'MasterDataPermissionError';
  }
}

/** 是否拥有手术主数据修改权限（通配 * 或显式权限码）。 */
export function canEditMasterData(permissions: string[] | null | undefined): boolean {
  if (!permissions) return false;
  return permissions.some((code) => code === '*' || code === MASTER_DATA_PERMISSION);
}

/** 只保留 module=operation 且 action=masterDataUpdate 的审计条目并展开 changeSummary。 */
export function formatMasterDataAudit(rawList: unknown): MasterDataAuditEntry[] {
  const list = Array.isArray(rawList) ? rawList : [];
  const entries: MasterDataAuditEntry[] = [];
  list.forEach((item) => {
    const record = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    if (record.module !== 'operation' || record.action !== 'masterDataUpdate') return;
    const summary = Array.isArray(record.changeSummary) ? record.changeSummary : [];
    summary.forEach((change) => {
      const c = (change && typeof change === 'object' ? change : {}) as Record<string, unknown>;
      entries.push({
        field: String(c.field ?? ''),
        label: c.label !== undefined && c.label !== null ? String(c.label) : undefined,
        before: c.before,
        after: c.after,
        reason: c.reason !== undefined && c.reason !== null ? String(c.reason) : undefined,
        actorId: record.actorId !== undefined && record.actorId !== null ? String(record.actorId) : undefined,
        actorRole: record.actorRole !== undefined && record.actorRole !== null ? String(record.actorRole) : undefined,
        occurredAt: record.occurredAt !== undefined && record.occurredAt !== null ? String(record.occurredAt) : undefined,
        result: record.result === 'pending' || record.result === 'success' || record.result === 'failure' ? record.result : undefined,
      });
    });
  });
  return entries;
}

export interface SaveMasterDataOptions {
  item: SurgeryCase;
  reason: string;
  changes: MasterDataChange[];
}

export interface SaveMasterDataResult {
  case: SurgeryCase;
  audit: MasterDataAuditEntry[];
}

/**
 * 受控保存主数据：POST 信封 → GET 回读（远端主数据胜出、本地临床保留）→ 读取审计历史。
 * POST 或 GET 任一步失败时不返回假成功；4091 抛 MasterDataConflictError。
 */
export async function saveMasterDataWithReadback(options: SaveMasterDataOptions): Promise<SaveMasterDataResult> {
  const { item, reason, changes } = options;
  const operationId = item.id;
  if (!operationId) {
    throw new Error('operationId不能为空');
  }

  const envelope = buildMasterDataUpdateEnvelope(item, reason, changes);

  try {
    await operationInfoApi.updateMasterData(envelope);
  } catch (error) {
    if (error instanceof SamisHttpError && error.code === MASTER_DATA_CONFLICT_CODE) {
      throw new MasterDataConflictError();
    }
    throw error;
  }

  // GET 回读：远端规范主数据重建，再与本地临床记录分层合并
  const raw = await operationInfoApi.getOperationInfo({ operationId, OPERATIONID: operationId });
  const fresh = mapOperationListItem(raw);
  const merged = mergeRemoteMasterWithLocalClinical(fresh, item);

  // 审计历史
  let audit: MasterDataAuditEntry[] = [];
  try {
    const auditResult = await authApi.auditByOperation(operationId);
    audit = formatMasterDataAudit((auditResult as { list?: unknown })?.list ?? auditResult);
  } catch {
    audit = [];
  }

  return { case: merged, audit };
}

export interface SaveScheduleMasterDataOptions {
  permissions: string[] | null | undefined;
  item: SurgeryCase;
  reason: string;
  changes: MasterDataChange[];
  /** 主数据 POST→GET 成功后独立执行的护理排班保存回调。 */
  saveNursePb?: (item: SurgeryCase, operationDate?: string) => Promise<unknown>;
  operationDate?: string;
}

export interface SaveScheduleMasterDataOutcome {
  case: SurgeryCase;
  audit: MasterDataAuditEntry[];
  nurseSaved: boolean;
  nurseError?: string;
}

/**
 * 排班页受控主数据保存编排：权限门禁 → 校验原因 → POST 信封（台次随 sequence 进入信封）→
 * GET 回读 → 护理排班独立保存。无权限时立即抛出，不发起任何主数据/护理/台次写请求。
 * 真实模式台次不再调用无 expectedVersion/reason 的旁路接口。
 */
export async function saveScheduleMasterData(
  options: SaveScheduleMasterDataOptions,
): Promise<SaveScheduleMasterDataOutcome> {
  if (!canEditMasterData(options.permissions)) {
    throw new MasterDataPermissionError();
  }
  const reason = options.reason.trim();
  if (!reason) {
    throw new Error('请填写修改原因');
  }

  const { case: merged, audit } = await saveMasterDataWithReadback({
    item: options.item,
    reason,
    changes: options.changes,
  });

  let nurseSaved = false;
  let nurseError: string | undefined;
  if (options.saveNursePb) {
    try {
      await options.saveNursePb(merged, options.operationDate);
      nurseSaved = true;
    } catch (e) {
      nurseError = e instanceof Error ? e.message : '护理排班保存失败';
    }
  }

  return { case: merged, audit, nurseSaved, nurseError };
}
