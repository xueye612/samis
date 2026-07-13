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

export interface MasterDataAuditEntry {
  field: string;
  label?: string;
  before: unknown;
  after: unknown;
  reason?: string;
  actorId?: string;
  actorRole?: string;
  occurredAt?: string;
}

export class MasterDataConflictError extends Error {
  constructor(message = '数据已被其他人修改，请刷新后重试') {
    super(message);
    this.name = 'MasterDataConflictError';
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
