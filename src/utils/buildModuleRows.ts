import type { ModuleRowItem } from '@/types/clinicalModules';
import type { useAnesthesiaStore } from '@/stores/anesthesia';

type Store = ReturnType<typeof useAnesthesiaStore>;

export function buildModuleRows(store: Store, key: string): ModuleRowItem[] {
  if (key === 'todos') {
    return store.todos.map((item) => ({
      id: item.id,
      label: item.title,
      desc: item.category,
      link: item.caseId,
    }));
  }
  if (key === 'qualityDefects') {
    return store.qualityDefects.map((item) => ({
      id: item.defectId,
      label: item.defectType,
      desc: item.defectDesc,
      link: item.caseId,
    }));
  }
  if (key === 'indicatorDetails') {
    return store.indicatorDetails.slice(0, 10).map((item) => ({
      id: item.code,
      label: item.name,
      desc: String(item.displayValue),
    }));
  }
  if (key === 'qualityReportCache') {
    return store.qualityReportCache.map((item) => ({
      id: item.period,
      label: item.period,
      desc: item.generatedAt,
    }));
  }
  if (key === 'pdcaRecords') {
    return store.pdcaRecords.map((item) => ({
      id: item.id,
      label: item.title,
      desc: item.problem,
    }));
  }
  if (key === 'auditLogs') {
    return store.auditLogs.map((item) => ({
      id: item.id,
      label: item.action,
      desc: item.detail,
      link: item.target,
    }));
  }
  if (key === 'integrationEndpoints') {
    return store.integrationEndpoints.map((item) => ({
      id: item.id,
      label: item.name,
      desc: item.endpoint,
      link: item.id,
    }));
  }
  if (key === 'systemUsers') {
    const groupNameById = new Map(store.remoteAdminUserGroups.map((g) => [String(g.groupid), g.name]));
    return store.systemUsers.map((item) => ({
      id: item.id,
      label: item.name,
      desc: groupNameById.get(String(item.role)) ?? String(item.role),
    }));
  }
  if (key === 'pacuPatients') {
    return store.pacuPatients.map((item) => ({
      id: item.id,
      label: item.patientName,
      desc: item.room,
      link: item.caseId,
    }));
  }
  if (key === 'followUps') {
    return store.followUps.map((item) => ({
      id: item.id,
      label: item.type,
      desc: String(item.vas),
      link: item.caseId,
    }));
  }
  if (key === 'qualityDataset') {
    return store.qualityDataset.events
      .filter((item) => item.isQualityEvent)
      .map((item) => ({
        id: item.eventId,
        label: item.eventType,
        desc: item.description,
        link: item.caseId,
      }));
  }
  if (key === 'roles') {
    return [
      { id: 'admin', label: '质控管理员', desc: '全部权限' },
      { id: 'anes', label: '麻醉医师', desc: '临床操作' },
    ];
  }
  if (key === 'mock') {
    return [{ id: 'seed', label: 'Mock 数据集', desc: 'qualitySeed + clinical 同步' }];
  }
  return store.cases.map((item) => ({
    id: item.id,
    label: item.patientName,
    desc: item.surgeryName,
    link: item.id,
  }));
}
