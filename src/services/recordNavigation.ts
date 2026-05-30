export type RecordEntrySource = 'plan' | 'schedule' | 'detail' | 'workbench';

export interface RecordReturnTarget {
  label: string;
  path: string;
  contextLabel: string;
}

const returnTargets: Record<RecordEntrySource, RecordReturnTarget> = {
  plan: { label: '返回麻醉计划', path: '/surgery/plan', contextLabel: '麻醉计划' },
  schedule: { label: '返回手术排班', path: '/surgery/schedule', contextLabel: '手术排班' },
  detail: { label: '返回患者麻醉详情', path: '/surgery/detail', contextLabel: '患者麻醉详情' },
  workbench: { label: '返回工作台', path: '/workbench/overview', contextLabel: '工作台' },
};

const isRecordEntrySource = (value: string): value is RecordEntrySource => value in returnTargets;

export function normalizeRecordEntrySource(source: unknown): RecordEntrySource {
  const value = Array.isArray(source) ? source[0] : source;
  return typeof value === 'string' && isRecordEntrySource(value) ? value : 'plan';
}

export function buildRecordReturnTarget(source: unknown, caseId?: string): RecordReturnTarget {
  const base = returnTargets[normalizeRecordEntrySource(source)];
  if (caseId && base.path === '/surgery/detail') {
    return { ...base, path: `/surgery/detail/${caseId}` };
  }
  return base;
}

export function buildRecordRoute(caseId: string, source: RecordEntrySource = 'plan') {
  return {
    name: 'record',
    params: { id: caseId },
    query: { from: source },
  };
}
