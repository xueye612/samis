import dayjs from 'dayjs';
import type { SurgeryCase } from '@/types/anesthesia';
import type { RecordPersistMeta } from '@/types/anesthesiaLocalDb';
import { dedupeVitalsById } from '@/services/anesthesiaRecordEngine';
import {
  loadAllCasesFromLocalDb,
  loadCaseFromLocalDb,
  loadCurrentPageFromLocalDb,
  saveCaseToLocalDb,
} from '@/services/anesthesia/anesthesiaRecordRepository';
import { triggerAnesthesiaSyncAfterChange } from '@/services/anesthesia/anesthesiaSyncService';
import { runStartupLocalCleanupIfDue } from '@/services/anesthesia/anesthesiaLocalCleanupService';
import { mergeRemoteMasterWithLocalClinical } from '@/services/anesthesia/adapters/operationInfoAdapter';

const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();
const DEBOUNCE_MS = 1000;

export async function ensureAnesthesiaPersistenceReady(): Promise<boolean> {
  const { useAnesthesiaStore } = await import('@/stores/anesthesia');
  await useAnesthesiaStore().bootstrapAnesthesiaLocalPersistence();
  return useAnesthesiaStore().localPersistenceReady;
}

export async function hydrateAnesthesiaCasesFromLocalDb(
  seedCases: SurgeryCase[],
  options?: { appendOrphans?: boolean },
): Promise<SurgeryCase[]> {
  const localCases = await loadAllCasesFromLocalDb();
  if (!localCases.length) return seedCases;
  // 分层合并：远端主数据（患者/手术/排班/人员/版本）胜出，本地临床记录胜出。
  // 禁止用整对象日期比较决定覆盖方向，避免“刷新恢复旧数据”。
  const merged = seedCases.map((seed) => {
    const local = localCases.find((item) => item.id === seed.id);
    if (!local) return seed;
    const normalizedLocal = { ...local, vitals: dedupeVitalsById(local.vitals) };
    return mergeRemoteMasterWithLocalClinical(seed, normalizedLocal);
  });
  if (options?.appendOrphans !== false) {
    localCases.forEach((local) => {
      const normalizedLocal = { ...local, vitals: dedupeVitalsById(local.vitals) };
      if (!merged.some((item) => item.id === normalizedLocal.id)) merged.push(normalizedLocal);
    });
  }
  return merged;
}

export function schedulePersistCase(
  caseItem: SurgeryCase | undefined,
  currentPage?: number,
  meta?: RecordPersistMeta,
) {
  if (!caseItem) return;
  const existing = persistTimers.get(caseItem.id);
  if (existing) clearTimeout(existing);
  persistTimers.set(caseItem.id, setTimeout(() => {
    void persistCaseNow(caseItem, currentPage, meta);
    persistTimers.delete(caseItem.id);
  }, DEBOUNCE_MS));
}

export async function persistCaseNow(
  caseItem: SurgeryCase,
  currentPage?: number,
  meta?: RecordPersistMeta,
) {
  await saveCaseToLocalDb(caseItem, currentPage, meta);
  triggerAnesthesiaSyncAfterChange(meta?.entityType);
}

export async function restoreCasePageNo(caseId: string): Promise<number> {
  return loadCurrentPageFromLocalDb(caseId);
}

export async function restoreSingleCase(caseId: string): Promise<SurgeryCase | null> {
  return loadCaseFromLocalDb(caseId);
}

export function markLocalSaved(caseId: string) {
  return dayjs().toISOString();
}
