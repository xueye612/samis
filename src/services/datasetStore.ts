import { cloneQualityDataset } from '@/services/clinicalSync';
import type { QualityDataset } from '@/types/mockTables';
import type { AuditLogEntry, IntegrationEndpoint, QualityReportCache, SystemUser } from '@/types/system';

let dataset: QualityDataset = cloneQualityDataset();
let datasetVersion = 0;

export function getMutableDataset(): QualityDataset {
  return dataset;
}

export function getDatasetVersion(): number {
  return datasetVersion;
}

export function replaceDataset(next: QualityDataset) {
  dataset = next;
  datasetVersion += 1;
}

export function bumpDatasetVersion() {
  datasetVersion += 1;
}

export function resetDataset(next: QualityDataset) {
  replaceDataset(next);
}

const auditLogs: AuditLogEntry[] = [
  { id: 'log-1', time: new Date().toISOString(), user: '质控管理员', module: '麻醉记录单', action: '锁定', target: 'case-or01', detail: 'OR-01 记录单打印后锁定' },
  { id: 'log-2', time: new Date().toISOString(), user: '王睿', module: 'PACU', action: '转出登记', target: 'case-or03', detail: 'PACU 转出至病房' },
];

export function getAuditLogs() {
  return auditLogs;
}

export function appendAuditLog(entry: Omit<AuditLogEntry, 'id' | 'time'>) {
  auditLogs.unshift({ ...entry, id: `log-${Date.now()}`, time: new Date().toISOString() });
}

const integrationEndpoints: IntegrationEndpoint[] = [
  { id: 'his', name: 'HIS/EMR', endpoint: 'http://mock-his.local/api', status: 'simulated', lastSync: new Date().toISOString(), description: '患者、手术申请、医嘱同步' },
  { id: 'lis', name: 'LIS', endpoint: 'http://mock-lis.local/api', status: 'simulated', lastSync: new Date().toISOString(), description: '检验结果回写' },
  { id: 'device', name: '设备中间件', endpoint: 'ws://mock-device.local/stream', status: 'simulated', lastSync: new Date().toISOString(), description: '监护仪、麻醉机、输液泵采集' },
];

export function getIntegrationEndpoints() {
  return integrationEndpoints;
}

export function updateIntegrationEndpoint(id: string, patch: Partial<IntegrationEndpoint>) {
  const index = integrationEndpoints.findIndex((item) => item.id === id);
  if (index >= 0) integrationEndpoints[index] = { ...integrationEndpoints[index], ...patch };
}

const systemUsers: SystemUser[] = [
  { id: 'u-1', username: 'admin', name: '质控管理员', role: 'admin', department: '麻醉科', active: true },
  { id: 'u-2', username: 'wangrui', name: '王睿', role: 'anesthesiologist', department: '麻醉科', active: true },
  { id: 'u-3', username: 'chenjie', name: '陈洁', role: 'nurse', department: '麻醉科', active: true },
];

export function getSystemUsers() {
  return systemUsers;
}

export function upsertSystemUser(user: SystemUser) {
  const index = systemUsers.findIndex((item) => item.id === user.id);
  if (index >= 0) systemUsers[index] = user;
  else systemUsers.push(user);
}

const qualityReportCache: QualityReportCache[] = [];

export function getQualityReportCache() {
  return qualityReportCache;
}

export function upsertQualityReportCache(entry: QualityReportCache) {
  const index = qualityReportCache.findIndex((item) => item.period === entry.period && item.hospitalId === entry.hospitalId);
  if (index >= 0) qualityReportCache[index] = entry;
  else qualityReportCache.push(entry);
}
