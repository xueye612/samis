import { defineStore } from 'pinia';
import dayjs from 'dayjs';
import {
  enabledDrugs,
  enabledVitalSigns,
  flattenMethodOptions,
  seedDrugDict,
  seedFluidBloodDict,
  seedAirwayMethods,
  seedBloodTypes,
  seedCollectStatuses,
  seedExtubationStatuses,
  seedFrequencyOptions,
  seedIntubationMethods,
  seedMethodCategories,
  seedRecordStatuses,
  seedRhTypes,
  seedTransferDestinations,
  seedTransfusionReactions,
  seedVitalSignDict,
} from '@/mock/configSeed';
import {
  buildInitialClinicalState,
  cloneQualityDataset,
  downloadTextFile,
  exportQualityCsv,
  syncAllClinicalToDataset,
  syncCaseToDataset,
  syncFollowUpToDataset,
  syncPacuToDataset,
} from '@/services/clinicalSync';
import {
  loadRecordLocalState,
  saveRecordLocalState,
  type RecordLocalState,
  LIVE_DEFAULT_SEGMENT_MINUTES,
  normalizeFluidFromDict,
  normalizeMedicationFromDrug,
  runUnifiedRecordQualityChecks,
  detectDictionaryDrivenAbnormalVitals,
  aggregateAbnormalVitalsForPanel,
  findVitalUpsertIndex,
  isRescueModeActive,
  resolveTimeAxisIntervals,
  buildRecordSnapshot,
  ensureRecordDocument,
  syncTransfusionEventsFromFluids,
  buildRecordSummaryFields,
  runPrintPreflightChecks,
  resolveDefaultMonitorOrder,
  isoOrClockToClock,
  dedupeVitalsById,
  DEFAULT_HOSPITAL_NAME,
  clockToMinutes,
  minutesToClock,
  resolveRecordSheetNowIso,
} from '@/services/anesthesiaRecordEngine';
import { applySpecialNumbersToMedications } from '@/services/medicationDisplayRules';
import { buildRecordPagination, resolveRecordPageNoForTime } from '@/services/recordPaginationEngine';
import type { RescueModeTransitionResult } from '@/services/anesthesia/rescueModeTransition';
import type { LabResultRecord, LayoutWarning, RecordSummaryFields, RecordSummaryNotes } from '@/types/anesthesiaRecord';
import {
  appendAuditLog,
  bumpDatasetVersion,
  getAuditLogs,
  getIntegrationEndpoints,
  getMutableDataset,
  getQualityReportCache,
  getSystemUsers,
  replaceDataset,
  upsertQualityReportCache,
  upsertSystemUser,
  updateIntegrationEndpoint,
} from '@/services/datasetStore';
import { invalidateQualityCache } from '@/services/qualityCache';
import { buildQualityScopeMeta, calculateIndicatorDetails } from '@/services/qualityCalculator';
import { applyDefectOverrides, detectQualityDefects } from '@/services/qualityDefectRules';
import {
  getDoctorCases,
  groupCasesByRoom,
  isCaseAssignedToDoctor,
  normalizeCaseSchedule,
  sortCasesByClinicalPriority,
} from '@/services/scheduleHelpers';
import {
  applyTimelineNodeTime,
  type MethodTimelineNode,
} from '@/services/methodTimelineEngine';
import { upsertTimedKeyOperationLine } from '@/utils/numberedNotes';
import {
  applyLandingSyncFields,
  applyProfessionalFieldLanding,
  buildLandingEvent,
  buildLandingMedication,
  mergeMonitorCodes,
} from '@/services/templateLanding';
import type { TemplateLandingItem } from '@/mock/anesthesiaRecordPrototype';
import type {
  AnesthesiaEvent,
  AnesthesiaPlaneRecord,
  FluidRecord,
  MedicationRecord,
  OutputDetailRecord,
  PacuPatient,
  PostoperativeFollowUp,
  RescueRecord,
  SurgeryCase,
  VitalSign,
} from '@/types/anesthesia';
import type { QualityCategory, QualityDefect, QualityFilter } from '@/types/quality';
import type { QualityDataset } from '@/types/mockTables';
import type {
  AnesthesiaMethodCategory,
  DictItem,
  DrugDictItem,
  FluidBloodDictItem,
  PdcaRecord,
  TodoItem,
  VitalSignDictItem,
} from '@/types/system';
import type {
  ComplicationRecord,
  ConsentRecord,
  ConsultationRecord,
  DrugInventoryItem,
  EmergencyCall,
  ExamReviewRecord,
  FavoriteItem,
  HandoverRecord,
  MonitorAlert,
  MonitorDevice,
  PacuBooking,
  PacuReceiveRecord,
  PacuRoom,
  QualityCheckRecord,
  SafetyCheckRecord,
  ScheduleDutySlot,
  SummaryRecord,
  SurgeryRequest,
  WorkflowMilestoneKey,
  WorkloadStats,
} from '@/types/clinicalModules';
import {
  buildComplications,
  buildConsentRecords,
  buildConsultations,
  buildDrugInventory,
  buildEmergencyCalls,
  buildExamReviews,
  buildFavorites,
  buildHandoverRecords,
  buildMonitorAlerts,
  buildMonitorDevices,
  buildPacuBookings,
  buildPacuReceives,
  buildPacuRooms,
  buildQualityChecks,
  buildSafetyChecks,
  buildScheduleDuty,
  buildSummaryRecords,
  buildSurgeryRequests,
  buildWorkloadStats,
} from '@/mock/clinicalModulesSeed';
import {
  fetchOperationList,
  hydrateCaseFromOperationInfo as hydrateCaseFromOperationInfoService,
} from '@/services/anesthesia/operationInfoService';
import { loadRoomCatalog } from '@/services/anesthesia/roomService';
import {
  disableDrugDictItem,
  loadDrugDictCatalog,
  persistDrugDictItem,
} from '@/services/anesthesia/anesthesiaDictService';
import { useRealOperationInfo, useRealAnesthesiaDict } from '@/config/apiFlags';
import type { RoomGroupCatalog } from '@/services/anesthesia/adapters/roomAdapter';
import {
  hydrateAnesthesiaCasesFromLocalDb,
  restoreSingleCase,
  schedulePersistCase,
} from '@/services/anesthesia/anesthesiaPersistenceBridge';
import {
  patchRecordDeviceCollectMeta,
  saveDeviceVitalOnly,
  loadAllCasesFromLocalDb,
} from '@/services/anesthesia/anesthesiaRecordRepository';
import {
  patchAnesthesiaSyncUiState,
  setAnesthesiaSyncRecordScope,
  startAnesthesiaSyncService,
  subscribeAnesthesiaSyncState,
  syncStatesEqual,
} from '@/services/anesthesia/anesthesiaSyncService';
import { startMonitorMockService, readMonitorDisplayIntervalMinutes, type MonitorMockHandle } from '@/services/anesthesia/monitorMockService';
import { startVentilatorMockService, type VentilatorMockHandle } from '@/services/anesthesia/ventilatorMockService';
import type { AnesthesiaSyncState, RecordPersistMeta, SyncConflictResolveAction } from '@/types/anesthesiaLocalDb';
import {
  listPendingConflicts,
  resolveSyncConflict,
  injectMockSyncConflict,
} from '@/services/anesthesia/anesthesiaSyncConflict';
import {
  readAbnormalSimulationTypes,
  readDeviceSimulationMode,
  writeAbnormalSimulationTypes,
  writeDeviceSimulationMode,
  type AbnormalSimulationType,
  type DeviceSimulationMode,
} from '@/services/anesthesia/deviceSimulationMode';
import { runStartupLocalCleanupIfDue } from '@/services/anesthesia/anesthesiaLocalCleanupService';
import {
  buildMonitoringSessionFromCase,
  clearAwayMockTimeout,
  dropSession,
  finalizeRevokedSession,
  finalizeStoppedSession,
  getActiveMockSession,
  getMonitoringRegistry,
  getMonitoringSession,
  loadMonitoringSessionFromDb,
  markMockPaused,
  markMockTicking,
  persistMonitoringRegistry,
  prepareScopeSwitchHint,
  resolveMonitoringViewUi,
  saveSession,
  scheduleAwayMockTimeout,
} from '@/services/anesthesia/monitoringSessionService';

let activeMonitorMock: MonitorMockHandle | null = null;
let activeVentilatorMock: VentilatorMockHandle | null = null;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const browserStorage = () => (typeof localStorage === 'undefined' ? undefined : localStorage);
const initialRecordLocalState = (): RecordLocalState => {
  const storage = browserStorage();
  return storage ? loadRecordLocalState(storage) : {};
};

const recalculateOutputs = (item: SurgeryCase) => {
  const details = (item.outputRecords ?? []).filter((row) => row.status !== 'voided');
  if (!(item.outputRecords ?? []).length) return;
  item.outputs = {
    urine: details.filter((row) => row.type === '尿量').reduce((sum, row) => sum + (Number(row.volume) || 0), 0),
    bloodLoss: details.filter((row) => row.type === '出血量').reduce((sum, row) => sum + (Number(row.volume) || 0), 0),
    drainage: details.filter((row) => row.type === '引流量').reduce((sum, row) => sum + (Number(row.volume) || 0), 0),
  };
};

const defaultFilter = (): QualityFilter => ({
  periodType: '月度',
  startMonth: dayjs().subtract(11, 'month').format('YYYY-MM'),
  endMonth: dayjs().format('YYYY-MM'),
  category: '全部',
  anesthesiaMethod: '全部',
  locationType: '全部',
  surgeryType: '全部',
  doctorId: '全部',
  roomId: '全部',
});

const initialClinical = buildInitialClinicalState();
const initialDataset = cloneQualityDataset();
syncAllClinicalToDataset(initialDataset, initialClinical.cases, initialClinical.pacuPatients, initialClinical.followUps);
replaceDataset(initialDataset);
const persistedRecordState = initialRecordLocalState();

export const useAnesthesiaStore = defineStore('anesthesia', {
  state: () => ({
    cases: clone(initialClinical.cases),
    pacuPatients: clone(initialClinical.pacuPatients),
    followUps: clone(initialClinical.followUps),
    currentDoctorName: '王睿',
    rescueModeCaseId: '',
    rescueFromDeviceSimCaseId: '',
    qualityFilter: defaultFilter(),
    selectedIndicatorCode: 'AQI-TMR-07',
    favoriteIndicatorCodes: ['AQI-DNR-01', 'AQI-ACC-02', 'AQI-PAO-03'] as string[],
    defectOverrides: {} as Record<string, Partial<QualityDefect>>,
    datasetVersion: 0,
    configRooms: ['OR-01', 'OR-02', 'OR-03', 'OR-04', 'OR-05', 'OR-06', 'PACU', '产房', '内镜中心'] as string[],
    configDrugs: clone(
      persistedRecordState.configDrugs?.length
        ? persistedRecordState.configDrugs
        : seedDrugDict,
    ) as DrugDictItem[],
    configMethods: clone(seedMethodCategories) as AnesthesiaMethodCategory[],
    configFluids: clone(
      persistedRecordState.configFluids?.length
        ? persistedRecordState.configFluids
        : seedFluidBloodDict,
    ) as FluidBloodDictItem[],
    configVitals: clone(
      persistedRecordState.configVitals?.length
        ? persistedRecordState.configVitals
        : seedVitalSignDict,
    ) as VitalSignDictItem[],
    configEvents: ['插管', '拔管', '低体温', '低血压', '低氧', '抢救', '非计划转ICU'] as string[],
    configScores: ['Aldrete', 'VAS', 'GCS', 'Apgar'] as string[],
    configPrintTemplates: ['麻醉记录单', '术前访视单', 'PACU恢复记录', '术后随访表'] as string[],
    configStaff: getSystemUsers().map((item) => item.name),
    configGenericDicts: {
      bloodTypes: [...(persistedRecordState.genericDicts?.bloodTypes ?? seedBloodTypes)],
      rhTypes: [...(persistedRecordState.genericDicts?.rhTypes ?? seedRhTypes)],
      transfusionReactions: [...(persistedRecordState.genericDicts?.transfusionReactions ?? seedTransfusionReactions)],
      airwayMethods: [...(persistedRecordState.genericDicts?.airwayMethods ?? seedAirwayMethods)],
      intubationMethods: [...(persistedRecordState.genericDicts?.intubationMethods ?? seedIntubationMethods)],
      extubationStatuses: [...(persistedRecordState.genericDicts?.extubationStatuses ?? seedExtubationStatuses)],
      transferDestinations: [...(persistedRecordState.genericDicts?.transferDestinations ?? seedTransferDestinations)],
      collectStatuses: [...(persistedRecordState.genericDicts?.collectStatuses ?? seedCollectStatuses)],
      recordStatuses: [...(persistedRecordState.genericDicts?.recordStatuses ?? seedRecordStatuses)],
      frequencyOptions: [...(persistedRecordState.genericDicts?.frequencyOptions ?? seedFrequencyOptions)],
    } as Record<string, string[]>,
    recordDrafts: clone(persistedRecordState.drafts ?? {}) as Record<string, unknown>,
    recordPageDrafts: {} as Record<string, number>,
    localDbReady: false,
    localPersistenceReady: false,
    isHydrating: false,
    hasRestoredLocalData: false,
    activeRecordScopeId: '' as string,
    operationListSource: '' as string,
    roomCatalogSource: '' as string,
    drugDictSource: '' as string,
    roomGroups: [] as RoomGroupCatalog[],
    anesthesiaSyncState: {
      pendingCount: 0,
      failedCount: 0,
      conflictCount: 0,
      uploading: false,
      online: typeof navigator === 'undefined' ? true : navigator.onLine,
      monitorRunning: false,
      ventilatorRunning: false,
      rescueMode: false,
    } as AnesthesiaSyncState,
    pdcaRecords: [
      {
        id: 'pdca-1',
        title: '全麻体温监测率提升',
        indicatorCode: 'AQI-TMR-07',
        problem: 'OR-02 长时间手术未记录体温',
        plan: '术中超120分钟自动提醒并纳入交班',
        doAction: '启用体温监测 checklist',
        checkResult: '监测率由66%提升至82%',
        actSummary: '纳入月度质控通报',
        owner: '质控管理员',
        status: '进行中',
        updatedAt: dayjs().toISOString(),
      },
    ] as PdcaRecord[],
    qualityRuleToggles: {
      tempRequired: true,
      vitalInterval: true,
      pacuDelay: true,
      infusionStop: true,
    },
    consentRecords: buildConsentRecords(initialClinical.cases) as ConsentRecord[],
    handoverRecords: buildHandoverRecords(initialClinical.cases) as HandoverRecord[],
    summaryRecords: buildSummaryRecords(initialClinical.cases) as SummaryRecord[],
    pacuRooms: buildPacuRooms(initialClinical.cases) as PacuRoom[],
    pacuReceives: buildPacuReceives(initialClinical.cases) as PacuReceiveRecord[],
    pacuBookings: buildPacuBookings(initialClinical.cases) as PacuBooking[],
    workloadStats: buildWorkloadStats(initialClinical.cases) as WorkloadStats,
    surgeryRequests: buildSurgeryRequests(initialClinical.cases) as SurgeryRequest[],
    consultations: buildConsultations(initialClinical.cases) as ConsultationRecord[],
    examReviews: buildExamReviews(initialClinical.cases) as ExamReviewRecord[],
    safetyChecks: buildSafetyChecks(initialClinical.cases) as SafetyCheckRecord[],
    monitorDevices: buildMonitorDevices(initialClinical.cases) as MonitorDevice[],
    monitorAlerts: buildMonitorAlerts(initialClinical.cases) as MonitorAlert[],
    complications: buildComplications(initialClinical.cases) as ComplicationRecord[],
    favorites: buildFavorites() as FavoriteItem[],
    scheduleDuty: buildScheduleDuty() as ScheduleDutySlot[],
    emergencyCalls: buildEmergencyCalls() as EmergencyCall[],
    qualityChecks: buildQualityChecks() as QualityCheckRecord[],
    drugInventory: buildDrugInventory() as DrugInventoryItem[],
    todoOverrides: {} as Record<string, TodoItem['status']>,
    hasShiftToday: true,
  }),
  getters: {
    qualityDataset(): QualityDataset {
      void this.datasetVersion;
      return getMutableDataset();
    },
    qualityScope(state) {
      void state.datasetVersion;
      return buildQualityScopeMeta(getMutableDataset(), state.qualityFilter);
    },
    indicatorDetails(state) {
      void state.datasetVersion;
      const details = calculateIndicatorDetails(getMutableDataset(), state.qualityFilter).map((item) => ({
        ...item,
        favorite: state.favoriteIndicatorCodes.includes(item.code),
      }));
      return state.qualityFilter.category === '全部' ? details : details.filter((item) => item.category === state.qualityFilter.category);
    },
    selectedIndicator(state) {
      void state.datasetVersion;
      return calculateIndicatorDetails(getMutableDataset(), state.qualityFilter)
        .map((item) => ({ ...item, favorite: state.favoriteIndicatorCodes.includes(item.code) }))
        .find((item) => item.code === state.selectedIndicatorCode);
    },
    rawQualityDefects(): QualityDefect[] {
      void this.datasetVersion;
      return detectQualityDefects(getMutableDataset());
    },
    qualityDefects(state): QualityDefect[] {
      return applyDefectOverrides(this.rawQualityDefects, state.defectOverrides);
    },
    dashboardIndicators(state) {
      void state.datasetVersion;
      return calculateIndicatorDetails(getMutableDataset(), state.qualityFilter).map((item) => ({
        code: item.code,
        group: item.category,
        name: item.name,
        numerator: item.numeratorLabel,
        denominator: item.denominatorLabel,
        target: item.warningRule ? `${item.warningRule.operator}${item.warningRule.value}${item.unit === 'count' || item.unit === 'ratio' ? '' : item.unit}` : '监测',
        currentValue: item.displayValue,
        trend: item.trend.map((point) => point.value),
        abnormalCases: item.defectCases.map((caseItem) => caseItem.patientName),
      }));
    },
    todaySummary(state) {
      const defects = applyDefectOverrides(detectQualityDefects(getMutableDataset()), state.defectOverrides);
      return {
        surgeries: state.cases.length,
        anesthetizing: state.cases.filter((item) => ['麻醉诱导', '麻醉中', '手术中'].includes(item.status)).length,
        pacu: state.pacuPatients.filter((item) => item.status !== '已转出').length,
        left: state.cases.filter((item) => item.status === '已离室').length,
        canceled: state.cases.filter((item) => item.status === '已取消').length,
        warnings: defects.length,
        adversePending: defects.filter((item) => item.status === '待确认').length,
      };
    },
    caseById: (state) => (id: string) => state.cases.find((item) => item.id === id),
    doctorOptions(state) {
      return Array.from(new Set([...state.configStaff, ...state.cases.flatMap((item) => [item.anesthesiologist, ...(item.assignedAnesthesiologistIds ?? [])])].filter(Boolean)));
    },
    myTodayCases(state) {
      return getDoctorCases(state.cases, state.currentDoctorName);
    },
    currentDoctorActiveCase(state) {
      return getDoctorCases(state.cases, state.currentDoctorName).find((item) => normalizeCaseSchedule(item).isActive);
    },
    nextDoctorCase(state) {
      const now = dayjs();
      return getDoctorCases(state.cases, state.currentDoctorName).find((item) => !normalizeCaseSchedule(item).isActive && dayjs(normalizeCaseSchedule(item).startTime).isAfter(now) && item.status !== '已取消');
    },
    roomSchedule(state) {
      return groupCasesByRoom(state.cases, state.configRooms);
    },
    sortedCases(state) {
      return sortCasesByClinicalPriority(state.cases);
    },
    isMyCase: (state) => (item: SurgeryCase) => isCaseAssignedToDoctor(item, state.currentDoctorName),
    enabledDrugOptions(state) {
      return enabledDrugs(state.configDrugs).map((item) => ({ label: item.name, value: item.name, item }));
    },
    enabledVitalSignItems(state) {
      return enabledVitalSigns(state.configVitals);
    },
    enabledChartVitalItems(state) {
      return enabledVitalSigns(state.configVitals).filter((item) => item.chartEnabled);
    },
    liveRecordQualityChecks: (state) => (caseId: string) => {
      const target = state.cases.find((item) => item.id === caseId);
      if (!target) return [];
      const defects = applyDefectOverrides(detectQualityDefects(getMutableDataset()), state.defectOverrides)
        .filter((item) => item.caseId === caseId);
      return runUnifiedRecordQualityChecks(target, { drugs: state.configDrugs, vitals: state.configVitals, fluids: state.configFluids }, defects);
    },
    caseQualityDefects: (state) => (caseId: string) => applyDefectOverrides(detectQualityDefects(getMutableDataset()), state.defectOverrides)
      .filter((item) => item.caseId === caseId),
    dictionaryDrivenAbnormalVitals: (state) => (caseId: string) => {
      const target = state.cases.find((item) => item.id === caseId);
      return target ? detectDictionaryDrivenAbnormalVitals(target.vitals, state.configVitals) : [];
    },
    panelAbnormalVitals: (state) => (caseId: string) => {
      const target = state.cases.find((item) => item.id === caseId);
      return target ? aggregateAbnormalVitalsForPanel(target.vitals, state.configVitals) : [];
    },
    flatMethodFilterOptions(state) {
      return flattenMethodOptions(state.configMethods);
    },
    todos(state): TodoItem[] {
      const items: TodoItem[] = [];
      state.cases
        .filter((item) => item.urgency === '择期' && !item.preVisit.completed)
        .forEach((item) => items.push({ id: `todo-pre-${item.id}`, title: `${item.patientName} 术前访视未完成`, category: '访视', caseId: item.id, priority: '高', dueTime: dayjs(item.plannedStart).subtract(1, 'day').toISOString(), status: '待处理' }));
      this.qualityDefects
        .filter((item) => item.status === '待整改' || item.status === '待确认')
        .forEach((item) => items.push({ id: `todo-def-${item.defectId}`, title: item.defectType, category: '缺陷', caseId: item.caseId, priority: item.defectLevel === '严重' ? '高' : '中', status: '待处理' }));
      state.pacuPatients
        .filter((item) => item.status !== '已转出' && dayjs().diff(dayjs(item.inTime), 'minute') > 120)
        .forEach((item) => items.push({ id: `todo-pacu-${item.id}`, title: `${item.patientName} PACU 转出延迟`, category: 'PACU', caseId: item.caseId, priority: '高', dueTime: dayjs(item.inTime).add(120, 'minute').toISOString(), status: '待处理' }));
      state.cases
        .filter((item) => item.postoperativeAnalgesia && !state.followUps.some((fu) => fu.caseId === item.id))
        .forEach((item) => items.push({ id: `todo-fu-${item.id}`, title: `${item.patientName} 术后镇痛随访`, category: '随访', caseId: item.id, priority: '中', status: '待处理' }));
      getMutableDataset().events
        .filter((item) => item.isQualityEvent && item.reviewStatus === '待审核')
        .forEach((item) => items.push({ id: `todo-ae-${item.eventId}`, title: `${item.eventType} 待审核`, category: '不良事件', caseId: item.caseId, priority: '高', status: '待处理' }));
      return items.map((item) => ({
        ...item,
        status: state.todoOverrides[item.id] ?? item.status,
      }));
    },
    filteredPacuRooms: (state) => (roomId?: string) => (roomId ? state.pacuRooms.filter((r) => r.id === roomId) : state.pacuRooms),
    pacuBedStats: (state) => {
      const beds = state.pacuRooms.flatMap((r) => r.beds);
      const total = beds.length;
      const used = beds.filter((b) => b.status === '占用').length;
      const free = beds.filter((b) => b.status === '空闲').length;
      return { total, used, free, occupancy: total ? Math.round((used / total) * 100) : 0 };
    },
    auditLogs: () => getAuditLogs(),
    integrationEndpoints: () => getIntegrationEndpoints(),
    systemUsers: () => getSystemUsers(),
    qualityReportCache: () => getQualityReportCache(),
  },
  actions: {
    /** 仅在未启用对应真实接口时回填演示种子，避免覆盖「远程为空」的真实状态 */
    async ensureClinicalSeedData() {
      if (!useRealOperationInfo() && !this.cases.length) {
        const fallback = await hydrateAnesthesiaCasesFromLocalDb(clone(buildInitialClinicalState().cases));
        this.cases = fallback;
        if (!this.operationListSource) this.operationListSource = 'seed';
        fallback.forEach((item) => syncCaseToDataset(getMutableDataset(), item));
        bumpDatasetVersion();
        this.datasetVersion += 1;
      }
      if (!useRealAnesthesiaDict() && !this.configDrugs.length) {
        this.configDrugs = clone(seedDrugDict);
        if (!this.drugDictSource) this.drugDictSource = 'seed';
      }
      if (!this.configFluids.length) {
        this.configFluids = clone(seedFluidBloodDict);
      }
      if (!this.configVitals.length) {
        this.configVitals = clone(seedVitalSignDict);
      }
    },
    async bootstrapAnesthesiaLocalPersistence() {
      if (this.localPersistenceReady) return;
      this.isHydrating = true;
      try {
        const localCases = await loadAllCasesFromLocalDb();
        this.hasRestoredLocalData = localCases.length > 0;
        if (useRealOperationInfo()) {
          this.cases = await hydrateAnesthesiaCasesFromLocalDb([], { appendOrphans: true });
        } else {
          this.cases = await hydrateAnesthesiaCasesFromLocalDb(clone(buildInitialClinicalState().cases));
        }
        this.localDbReady = true;
        this.localPersistenceReady = true;
        await this.loadSamisBaseCatalog();
        await this.ensureClinicalSeedData();
        startAnesthesiaSyncService();
        subscribeAnesthesiaSyncState((state) => {
          if (syncStatesEqual(this.anesthesiaSyncState, state)) return;
          this.anesthesiaSyncState = state;
        });
        void this.refreshSyncConflicts();
        void runStartupLocalCleanupIfDue();
        await loadMonitoringSessionFromDb();
      } finally {
        this.isHydrating = false;
      }
    },
    setCurrentUserFromSession(profile?: { displayName?: string; loginName?: string; defaultRoom?: string }) {
      if (profile?.displayName) {
        this.currentDoctorName = profile.displayName;
      }
      if (profile?.defaultRoom) {
        this.qualityFilter = { ...this.qualityFilter, roomId: profile.defaultRoom };
      }
    },
    async loadRemoteOperationList(params?: {
      operationDate?: string;
      room?: string;
      roomId?: string;
      patientName?: string;
      inpatientNo?: string;
    }) {
      const result = await fetchOperationList(params);
      this.cases = result.cases;
      this.operationListSource = result.source;
      if (result.cases.length) {
        result.cases.forEach((item) => syncCaseToDataset(getMutableDataset(), item));
        bumpDatasetVersion();
        this.datasetVersion += 1;
      }
      await this.ensureClinicalSeedData();
      return result;
    },
    async loadRoomCatalog() {
      const catalog = await loadRoomCatalog();
      this.configRooms = catalog.roomNames;
      this.roomGroups = catalog.groups;
      this.roomCatalogSource = catalog.source;
      return catalog;
    },
    async loadRemoteDrugDict(params?: { keyword?: string; enabled?: boolean }) {
      const result = await loadDrugDictCatalog(params);
      this.drugDictSource = result.source;
      if (useRealAnesthesiaDict()) {
        this.configDrugs = result.items;
      } else if (result.items.length) {
        this.configDrugs = result.items;
      }
      await this.ensureClinicalSeedData();
      return result;
    },
    async loadSamisBaseCatalog() {
      const results = await Promise.allSettled([
        this.loadRoomCatalog(),
        this.loadRemoteOperationList({ operationDate: dayjs().format('YYYY-MM-DD') }),
        this.loadRemoteDrugDict({ enabled: true }),
      ]);
      results.forEach((entry, index) => {
        if (entry.status === 'rejected') {
          console.warn('[samis] loadSamisBaseCatalog task failed', index, entry.reason);
        }
      });
      await this.ensureClinicalSeedData();
    },
    async hydrateCaseFromOperationInfo(caseId: string) {
      const index = this.cases.findIndex((item) => item.id === caseId);
      if (index < 0) return null;
      const merged = await hydrateCaseFromOperationInfoService(this.cases[index]);
      if (!merged) return null;
      this.cases[index] = merged;
      syncCaseToDataset(getMutableDataset(), merged);
      bumpDatasetVersion();
      this.datasetVersion += 1;
      return merged;
    },
    async refreshOperationInfoIfAllowed(caseId: string) {
      return this.hydrateCaseFromOperationInfo(caseId);
    },
    validateDeviceMockContext(caseId: string): { ok: boolean; message?: string } {
      if (!this.localPersistenceReady || this.isHydrating) {
        return { ok: false, message: '请先等待本地数据恢复完成' };
      }
      const target = this.cases.find((item) => item.id === caseId);
      if (!target) {
        return { ok: false, message: '请先打开或创建麻醉记录单后再启动设备模拟' };
      }
      const operationId = target.id;
      const patientId = target.patientId ?? target.id;
      if (!operationId || !patientId) {
        return { ok: false, message: '请先打开或创建麻醉记录单后再启动设备模拟' };
      }
      if (target.locked) {
        return { ok: false, message: '记录已锁定，无法启动设备模拟' };
      }
      return { ok: true };
    },
    setRecordPageDraft(caseId: string, pageNo: number) {
      this.recordPageDrafts[caseId] = pageNo;
    },
    /** 按时间点定位页码并写入页码草稿（与 syncRecordDocument 刻度一致） */
    focusRecordPageByTime(caseId: string, time?: string): number {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target) return 1;
      const intervals = resolveTimeAxisIntervals(target);
      const pageNo = resolveRecordPageNoForTime(target, time, {
        minorInterval: intervals.minorInterval,
        majorInterval: intervals.majorInterval,
      });
      this.setRecordPageDraft(caseId, pageNo);
      return pageNo;
    },
    restoreDeviceSimulationFromRescue(caseId: string): boolean {
      if (readDeviceSimulationMode() !== 'rescue') return false;
      writeDeviceSimulationMode('normal');
      if (this.rescueFromDeviceSimCaseId === caseId) this.rescueFromDeviceSimCaseId = '';
      const target = this.cases.find((item) => item.id === caseId);
      if (target?.device) {
        const running = this.anesthesiaSyncState.monitorRunning || this.anesthesiaSyncState.ventilatorRunning;
        target.device.collectStatus = running ? '采集中' : '已结束';
      }
      return true;
    },
    afterRecordMutation(caseId: string, meta?: RecordPersistMeta) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target) return;
      const pageNo = this.recordPageDrafts[caseId] ?? 1;
      schedulePersistCase(target, pageNo, meta);
      this.anesthesiaSyncState = {
        ...this.anesthesiaSyncState,
        localSavedAt: new Date().toISOString(),
      };
    },
    onDeviceVitalAppended(caseId: string, vital: import('@/types/anesthesia').VitalSign) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target) return;
      target.vitals = dedupeVitalsById(target.vitals);
      target.vitals.sort((a, b) => a.time.localeCompare(b.time));
      if (target.device) {
        target.device.lastCollectTime = vital.time;
      }
      const session = getMonitoringSession(caseId);
      if (session) {
        saveSession({ ...session, lastCollectTime: vital.time });
        void persistMonitoringRegistry();
      }
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
      void saveDeviceVitalOnly(target, vital);
      void patchRecordDeviceCollectMeta(caseId, {
        lastCollectTime: vital.time,
        collectStatus: target.device?.collectStatus,
      });
      if (this.activeRecordScopeId === caseId) {
        this.applyMonitoringUiForScope(caseId);
      }
    },
    applyMonitoringUiForScope(viewCaseId: string) {
      const ui = resolveMonitoringViewUi(viewCaseId, getMonitoringRegistry());
      const viewCase = this.cases.find((item) => item.id === viewCaseId);
      const ownerId = getActiveMockSession()?.recordLocalId ?? viewCaseId;
      const ownerCase = this.cases.find((item) => item.id === ownerId);
      patchAnesthesiaSyncUiState({
        monitorRunning: ui.monitorRunning,
        ventilatorRunning: ui.ventilatorRunning,
        lastCollectTime: ownerCase?.device?.lastCollectTime
          ?? getMonitoringSession(viewCaseId)?.lastCollectTime
          ?? viewCase?.device?.lastCollectTime,
        rescueMode: Boolean(viewCase && isRescueModeActive(viewCase)),
      });
    },
    onMonitoringCollect(recordLocalId: string, ts: string) {
      const session = getMonitoringSession(recordLocalId);
      if (!session) return;
      saveSession({ ...session, lastCollectTime: ts });
      void persistMonitoringRegistry();
      if (this.activeRecordScopeId === recordLocalId) {
        this.applyMonitoringUiForScope(recordLocalId);
      }
    },
    buildDeviceMockOptions(caseId: string, displayIntervalMinutes?: number) {
      const target = this.cases.find((item) => item.id === caseId)!;
      const simulationMode = readDeviceSimulationMode();
      return {
        rescueMode: isRescueModeActive(target) || simulationMode === 'rescue',
        displayIntervalMinutes,
        simulationMode,
        abnormalTypes: readAbnormalSimulationTypes(),
        onCollect: (id: string, collectTs: string) => this.onMonitoringCollect(id, collectTs),
      };
    },
    pauseMonitoringMockTimers() {
      activeMonitorMock?.stop();
      activeMonitorMock = null;
      activeVentilatorMock?.stop();
      activeVentilatorMock = null;
      const bound = getActiveMockSession();
      if (!bound) return;
      const paused = markMockPaused(bound);
      saveSession(paused);
      void persistMonitoringRegistry();
    },
    startMonitoringMockTicks(caseId: string) {
      const session = getMonitoringSession(caseId);
      if (!session || (!session.monitorActive && !session.ventilatorActive)) {
        return { ok: false as const, message: '无活动监护会话' };
      }
      const check = this.validateDeviceMockContext(caseId);
      if (!check.ok) return check;

      activeMonitorMock?.stop();
      activeVentilatorMock?.stop();
      activeMonitorMock = null;
      activeVentilatorMock = null;

      const resolveCase = () => this.cases.find((item) => item.id === caseId);
      const interval = session.displayIntervalMinutes ?? readMonitorDisplayIntervalMinutes();
      const mockOptions = this.buildDeviceMockOptions(caseId, interval);

      if (session.monitorActive) {
        activeMonitorMock = startMonitorMockService(
          caseId,
          resolveCase,
          (id, vital) => this.onDeviceVitalAppended(id, vital),
          mockOptions,
        );
      }
      if (session.ventilatorActive) {
        activeVentilatorMock = startVentilatorMockService(
          caseId,
          resolveCase,
          (id, vital) => this.onDeviceVitalAppended(id, vital),
          mockOptions,
        );
      }

      markMockTicking(session, true);
      void persistMonitoringRegistry();
      this.applyMonitoringUiForScope(this.activeRecordScopeId || caseId);
      return { ok: true as const };
    },
    ensureMonitoringSession(caseItem: SurgeryCase) {
      let session = getMonitoringSession(caseItem.id);
      if (!session || session.status === 'stopped' || session.status === 'revoked') {
        session = buildMonitoringSessionFromCase(caseItem);
        saveSession(session);
      }
      return session;
    },
    async mergeCaseFromLocalDb(caseId: string) {
      const local = await restoreSingleCase(caseId);
      if (!local) return;
      const index = this.cases.findIndex((item) => item.id === caseId);
      const normalized = { ...local, vitals: dedupeVitalsById(local.vitals) };
      if (index >= 0) {
        this.cases[index] = normalized;
        syncCaseToDataset(getMutableDataset(), normalized);
        bumpDatasetVersion();
        this.datasetVersion += 1;
      }
    },
    prepareRecordScopeSwitch(nextCaseId: string) {
      const fromId = this.activeRecordScopeId || nextCaseId;
      return prepareScopeSwitchHint(fromId, nextCaseId, getMonitoringRegistry());
    },
    checkMonitoringResumePrompt(caseId: string) {
      const session = getMonitoringSession(caseId);
      const show = Boolean(
        session
        && session.recordLocalId === caseId
        && session.mockResumePending
        && (session.monitorActive || session.ventilatorActive)
        && session.status !== 'revoked',
      );
      return { show, session };
    },
    dismissMonitoringResumePrompt(caseId: string) {
      const session = getMonitoringSession(caseId);
      if (!session) return;
      saveSession({ ...session, mockResumePending: false });
      void persistMonitoringRegistry();
    },
    resumeMonitoringMock(caseId: string) {
      const session = getMonitoringSession(caseId);
      if (!session) return { ok: false as const, message: '无监护会话' };
      saveSession({ ...session, mockResumePending: false, status: 'active' });
      void persistMonitoringRegistry();
      return this.startMonitoringMockTicks(caseId);
    },
    async setActiveAnesthesiaRecordScope(caseId: string) {
      const prevScope = this.activeRecordScopeId;
      this.activeRecordScopeId = caseId;
      const target = this.cases.find((item) => item.id === caseId);
      setAnesthesiaSyncRecordScope(caseId);

      if (prevScope && prevScope !== caseId) {
        const leavingSession = getMonitoringSession(prevScope);
        if (leavingSession && (leavingSession.monitorActive || leavingSession.ventilatorActive)) {
          this.pauseMonitoringMockTimers();
          scheduleAwayMockTimeout(() => {
            const paused = getMonitoringSession(prevScope);
            if (paused && !paused.mockTicking) {
              saveSession(markMockPaused(paused));
              void persistMonitoringRegistry();
            }
          });
        }
      } else {
        clearAwayMockTimeout();
      }

      if (getMonitoringSession(caseId)) {
        await this.mergeCaseFromLocalDb(caseId);
      }

      this.applyMonitoringUiForScope(caseId);
      void this.hydrateCaseFromOperationInfo(caseId);
    },
    startMonitorDeviceMock(caseId: string, displayIntervalMinutes?: number) {
      const check = this.validateDeviceMockContext(caseId);
      if (!check.ok) return check;
      const target = this.cases.find((item) => item.id === caseId)!;

      const bound = getActiveMockSession();
      if (bound && bound.recordLocalId !== caseId && bound.mockTicking) {
        this.pauseMonitoringMockTimers();
      }

      let session = this.ensureMonitoringSession(target);
      session = {
        ...session,
        monitorActive: true,
        mockResumePending: false,
        status: 'active',
        displayIntervalMinutes: displayIntervalMinutes ?? session.displayIntervalMinutes ?? readMonitorDisplayIntervalMinutes(),
      };
      saveSession(session);
      void persistMonitoringRegistry();

      if (target.device) {
        target.device.collectStatus = '采集中';
        target.device.monitor = '模拟采集中';
        void patchRecordDeviceCollectMeta(caseId, {
          collectStatus: '采集中',
          monitor: '模拟采集中',
        });
      }

      return this.startMonitoringMockTicks(caseId);
    },
    stopMonitorDeviceMock() {
      const scopeId = this.activeRecordScopeId;
      if (!scopeId) {
        activeMonitorMock?.stop();
        activeMonitorMock = null;
        return;
      }
      const session = getMonitoringSession(scopeId);
      activeMonitorMock?.stop();
      activeMonitorMock = null;
      if (!session) return;

      let next = {
        ...session,
        monitorActive: false,
        mockTicking: Boolean(session.ventilatorActive && activeVentilatorMock),
      };
      const target = this.cases.find((item) => item.id === scopeId);
      if (!next.monitorActive && !next.ventilatorActive) {
        next = finalizeStoppedSession(next);
        dropSession(scopeId);
        if (target?.device) {
          target.device.monitor = '已停止';
          target.device.collectStatus = '已结束';
          void patchRecordDeviceCollectMeta(scopeId, {
            collectStatus: '已结束',
            monitor: '已停止',
          });
        }
      } else {
        next = markMockPaused(next);
        saveSession(next);
        if (target?.device) {
          target.device.monitor = '已停止';
          void patchRecordDeviceCollectMeta(scopeId, { monitor: '已停止' });
        }
      }
      void persistMonitoringRegistry();
      this.applyMonitoringUiForScope(scopeId);
    },
    startVentilatorDeviceMock(caseId: string, displayIntervalMinutes?: number) {
      const check = this.validateDeviceMockContext(caseId);
      if (!check.ok) return check;
      const target = this.cases.find((item) => item.id === caseId)!;

      const bound = getActiveMockSession();
      if (bound && bound.recordLocalId !== caseId && bound.mockTicking) {
        this.pauseMonitoringMockTimers();
      }

      let session = this.ensureMonitoringSession(target);
      session = {
        ...session,
        ventilatorActive: true,
        mockResumePending: false,
        status: 'active',
        displayIntervalMinutes: displayIntervalMinutes ?? session.displayIntervalMinutes ?? readMonitorDisplayIntervalMinutes(),
      };
      saveSession(session);
      void persistMonitoringRegistry();

      if (target.device) {
        target.device.anesthesiaMachine = '模拟采集中';
        void patchRecordDeviceCollectMeta(caseId, {
          anesthesiaMachine: '模拟采集中',
        });
      }

      return this.startMonitoringMockTicks(caseId);
    },
    stopVentilatorDeviceMock() {
      const scopeId = this.activeRecordScopeId;
      if (!scopeId) {
        activeVentilatorMock?.stop();
        activeVentilatorMock = null;
        return;
      }
      const session = getMonitoringSession(scopeId);
      activeVentilatorMock?.stop();
      activeVentilatorMock = null;
      if (!session) return;

      let next = {
        ...session,
        ventilatorActive: false,
        mockTicking: Boolean(session.monitorActive && activeMonitorMock),
      };
      const target = this.cases.find((item) => item.id === scopeId);
      if (!next.monitorActive && !next.ventilatorActive) {
        next = finalizeStoppedSession(next);
        dropSession(scopeId);
        if (target?.device) {
          target.device.anesthesiaMachine = '已停止';
          target.device.collectStatus = '已结束';
          void patchRecordDeviceCollectMeta(scopeId, {
            collectStatus: '已结束',
            anesthesiaMachine: '已停止',
          });
        }
      } else {
        next = markMockPaused(next);
        saveSession(next);
        if (target?.device) {
          target.device.anesthesiaMachine = '已停止';
          void patchRecordDeviceCollectMeta(scopeId, { anesthesiaMachine: '已停止' });
        }
      }
      void persistMonitoringRegistry();
      this.applyMonitoringUiForScope(scopeId);
    },
    stopAllMonitoringDevices() {
      const scopeId = this.activeRecordScopeId;
      activeMonitorMock?.stop();
      activeMonitorMock = null;
      activeVentilatorMock?.stop();
      activeVentilatorMock = null;
      if (!scopeId) return;
      const session = getMonitoringSession(scopeId);
      if (!session) return;
      const stopped = finalizeStoppedSession({
        ...session,
        monitorActive: false,
        ventilatorActive: false,
      });
      dropSession(scopeId);
      void persistMonitoringRegistry();
      const target = this.cases.find((item) => item.id === scopeId);
      if (target?.device) {
        target.device.collectStatus = '已结束';
        target.device.monitor = '已停止';
        target.device.anesthesiaMachine = '已停止';
        void patchRecordDeviceCollectMeta(scopeId, {
          collectStatus: '已结束',
          monitor: '已停止',
          anesthesiaMachine: '已停止',
        });
      }
      this.applyMonitoringUiForScope(scopeId);
    },
    revokeMonitoringSession(caseId: string, reason: string) {
      if (!reason.trim()) return { ok: false as const, message: '请填写撤销原因' };
      this.pauseMonitoringMockTimers();
      const session = getMonitoringSession(caseId);
      if (!session) return { ok: false as const, message: '无监护会话' };
      const target = this.cases.find((item) => item.id === caseId);
      if (!target) return { ok: false as const, message: '记录单不存在' };

      const startedAt = session.startedAt;
      target.vitals = target.vitals.map((vital) => {
        if (vital.source !== '设备采集') return vital;
        if (dayjs(vital.time).isBefore(startedAt)) return vital;
        if (vital.status === 'voided') return vital;
        return {
          ...vital,
          status: 'voided' as const,
          voidReason: reason,
          voidedAt: dayjs().toISOString(),
        };
      });

      finalizeRevokedSession(session, reason);
      dropSession(caseId);
      void persistMonitoringRegistry();

      if (target.device) {
        target.device.collectStatus = '未连接';
        target.device.monitor = '未连接';
        target.device.anesthesiaMachine = '未连接';
        void patchRecordDeviceCollectMeta(caseId, {
          collectStatus: '未连接',
          monitor: '未连接',
          anesthesiaMachine: '未连接',
        });
      }
      this.afterRecordMutation(caseId, { voidReason: reason, entityType: 'vital_sign' });
      this.syncRecordDocument(caseId);
      this.applyMonitoringUiForScope(this.activeRecordScopeId || caseId);
      return { ok: true as const };
    },
    restartDeviceMocksForInterval(caseId: string) {
      const session = getMonitoringSession(caseId);
      if (!session || (!session.monitorActive && !session.ventilatorActive)) return;
      this.pauseMonitoringMockTimers();
      this.startMonitoringMockTicks(caseId);
      const target = this.cases.find((item) => item.id === caseId);
      patchAnesthesiaSyncUiState({
        rescueMode: Boolean(target && (isRescueModeActive(target) || readDeviceSimulationMode() === 'rescue')),
      });
    },
    setDeviceSimulationMode(caseId: string, mode: DeviceSimulationMode) {
      writeDeviceSimulationMode(mode);
      const target = this.cases.find((item) => item.id === caseId);
      if (mode === 'rescue' && target && !isRescueModeActive(target)) {
        this.enterRescueRecordMode(caseId);
        this.rescueFromDeviceSimCaseId = caseId;
      } else if (mode !== 'rescue' && this.rescueFromDeviceSimCaseId === caseId && target && isRescueModeActive(target)) {
        this.exitRescueRecordMode(caseId, '设备模拟退出抢救模式');
        this.rescueFromDeviceSimCaseId = '';
      }
      if (target?.device) {
        target.device.collectStatus = '采集中';
      }
      this.restartDeviceMocksForInterval(caseId);
    },
    setAbnormalSimulationTypes(types: AbnormalSimulationType[]) {
      writeAbnormalSimulationTypes(types);
    },
    async injectMockSyncConflict(caseId: string) {
      await injectMockSyncConflict(caseId);
      await this.refreshSyncConflicts(caseId);
    },
    seedBoundaryVitalsForTest(caseId: string) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target) return null;
      if (!target.surgeryEnd) {
        target.surgeryEnd = dayjs(target.roomInTime ?? target.plannedStart).add(420, 'minute').toISOString();
      }
      this.syncRecordDocument(caseId);
      const { pages } = buildRecordPagination(target);
      if (pages.length < 2) return { pages: pages.length, boundary: pages[0]?.pageEndTime };
      const page0 = pages[0];
      const boundaryMinutes = clockToMinutes(page0.pageEndTime);
      if (boundaryMinutes === null) return null;
      const datePrefix = dayjs(target.roomInTime ?? target.plannedStart).format('YYYY-MM-DD');
      const beforeTime = `${datePrefix}T${minutesToClock(boundaryMinutes - 2)}:00`;
      const boundaryTime = `${datePrefix}T${page0.pageEndTime}:00`;
      const vitals: VitalSign[] = [
        {
          id: `vital-boundary-before-${Date.now()}`,
          time: beforeTime,
          HR: 78,
          SBP: 118,
          DBP: 72,
          SpO2: 98,
          source: '设备采集',
        },
        {
          id: `vital-boundary-after-${Date.now() + 1}`,
          time: boundaryTime,
          HR: 80,
          SBP: 120,
          DBP: 74,
          SpO2: 99,
          source: '设备采集',
        },
      ];
      target.vitals.push(...vitals);
      target.vitals = dedupeVitalsById(target.vitals);
      target.vitals.sort((a, b) => a.time.localeCompare(b.time));
      this.afterRecordMutation(caseId);
      return {
        page0End: page0.pageEndTime,
        page1Start: pages[1].pageStartTime,
        beforeTime: isoOrClockToClock(beforeTime),
        boundaryTime: page0.pageEndTime,
      };
    },
    async refreshSyncConflicts(caseId?: string) {
      const conflicts = await listPendingConflicts(caseId);
      this.anesthesiaSyncState = {
        ...this.anesthesiaSyncState,
        conflictCount: conflicts.length,
      };
      return conflicts;
    },
    async resolveRecordSyncConflict(caseId: string, conflictId: string, action: SyncConflictResolveAction, mergedPayload?: unknown) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target) return;
      await resolveSyncConflict(conflictId, action, target, { mergedPayload });
      this.syncRecordDocument(caseId);
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
      await this.refreshSyncConflicts(caseId);
    },
    persistRecordLocalState() {
      const storage = browserStorage();
      if (!storage) return;
      saveRecordLocalState(storage, {
        configDrugs: this.configDrugs,
        configVitals: this.configVitals,
        configFluids: this.configFluids,
        genericDicts: this.configGenericDicts,
        drafts: this.recordDrafts,
      });
    },
    saveRecordDraft(caseId: string, draft: unknown) {
      this.recordDrafts[caseId] = draft;
      this.persistRecordLocalState();
    },
    saveMonitorOrderDraft(caseId: string, monitorOrder: string[]) {
      const current = (this.recordDrafts[caseId] && typeof this.recordDrafts[caseId] === 'object')
        ? this.recordDrafts[caseId] as Record<string, unknown>
        : {};
      this.recordDrafts[caseId] = { ...current, monitorOrder };
      this.persistRecordLocalState();
    },
    startAnesthesiaRecord(caseId: string) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked) return;
      const now = resolveRecordSheetNowIso(target);
      target.recordStatus = '采集中';
      target.collectStatus = '采集中';
      target.actualStart = target.actualStart ?? now;
      target.anesthesiaStart = target.anesthesiaStart ?? now;
      target.device = {
        monitor: '采集中',
        anesthesiaMachine: '采集中',
        infusionPump: '已连接',
        collectStatus: '采集中',
        dataSource: '手工录入 + 设备采集占位',
        lastCollectTime: now,
        collectFrequency: target.vitalFrequency ?? '5分钟',
        receiveStatus: '接收正常',
        logs: [{ time: now, content: '启动设备采集模拟' }],
      };
      target.operationLogs = ['启动麻醉记录并进入采集', ...(target.operationLogs ?? [])].slice(0, 8);
      const draft = (this.recordDrafts[caseId] && typeof this.recordDrafts[caseId] === 'object')
        ? this.recordDrafts[caseId] as Record<string, unknown>
        : {};
      if (!Array.isArray(draft.monitorOrder) || !(draft.monitorOrder as string[]).length) {
        this.saveMonitorOrderDraft(caseId, resolveDefaultMonitorOrder(this.configVitals));
      }
      this.appendVital(caseId, {
        id: `vital-${Date.now()}`,
        time: now,
        source: '设备采集占位',
        ...Object.fromEntries(this.enabledVitalSignItems.map((item) => [item.shortCode, Number(item.defaultValue) || undefined]).filter(([, value]) => value !== undefined)),
      } as VitalSign);
    },
    importRecordDeviceVitals(caseId: string) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked) return;
      const latest = target.vitals[target.vitals.length - 1] ?? {};
      const now = dayjs().toISOString();
      const payload: Record<string, unknown> = { id: `vital-${Date.now()}`, time: now, source: '设备采集占位' };
      this.enabledVitalSignItems.forEach((item) => {
        const currentValue = latest[item.shortCode as keyof VitalSign];
        payload[item.shortCode] = typeof currentValue === 'number' ? currentValue : Number(item.defaultValue) || undefined;
      });
      target.device = target.device ?? {
        monitor: '采集中',
        anesthesiaMachine: '采集中',
        infusionPump: '已连接',
        collectStatus: '采集中',
        dataSource: '手工录入 + 设备采集占位',
        logs: [],
      };
      target.device.collectStatus = '采集中';
      target.device.lastCollectTime = now;
      target.device.logs.unshift({ time: now, content: '从设备采集占位带入生命体征' });
      this.appendVital(caseId, payload as unknown as VitalSign);
    },
    enterRescueRecordMode(caseId: string): RescueModeTransitionResult {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked || isRescueModeActive(target)) return { ok: false };
      const now = dayjs().toISOString();
      this.rescueModeCaseId = caseId;
      target.vitalFrequency = '抢救1分钟';
      target.rescue = {
        startTime: now,
        measures: '启动抢救模式，持续评估循环、呼吸和氧合。',
        medications: '',
        participants: [target.anesthesiologist, target.anesthesiaNurse].filter(Boolean) as string[],
        supplementReminder: true,
      };
      this.appendEvent(caseId, { type: '抢救', stage: '术中', severity: '危急', treatment: '进入抢救模式，生命体征记录频率提高至1分钟。' });
      this.syncRecordDocument(caseId);
      const pageNo = this.focusRecordPageByTime(caseId, now);
      this.afterRecordMutation(caseId);
      patchAnesthesiaSyncUiState({ rescueMode: true });
      this.restartDeviceMocksForInterval(caseId);
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
      return { ok: true, pageNo, focusTime: now };
    },
    exitRescueRecordMode(caseId: string, result = '抢救结束，生命体征趋于稳定。'): RescueModeTransitionResult {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked || !isRescueModeActive(target)) return { ok: false };
      const endTime = dayjs().toISOString();
      target.rescue = {
        ...target.rescue!,
        endTime,
        result,
        supplementReminder: true,
      };
      target.vitalFrequency = '5分钟';
      if (this.rescueModeCaseId === caseId) this.rescueModeCaseId = '';
      this.appendEvent(caseId, { type: '抢救结束', stage: '术中', severity: '重度', treatment: result });
      const deviceSimRestored = this.restoreDeviceSimulationFromRescue(caseId);
      this.syncRecordDocument(caseId);
      const pageNo = this.focusRecordPageByTime(
        caseId,
        endTime
          || target.device?.lastCollectTime
          || target.vitals[target.vitals.length - 1]?.time,
      );
      this.afterRecordMutation(caseId);
      patchAnesthesiaSyncUiState({ rescueMode: false });
      this.restartDeviceMocksForInterval(caseId);
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
      return { ok: true, pageNo, focusTime: endTime, deviceSimRestored };
    },
    appendMedicationFromDict(caseId: string, drugName: string) {
      const drug = this.configDrugs.find((item) => item.enabled && item.name === drugName);
      if (!drug) return;
      const payload = normalizeMedicationFromDrug(drug, this.currentDoctorName);
      this.appendMedication(caseId, { ...payload, time: dayjs().toISOString(), startTime: dayjs().toISOString() });
    },
    appendFluidFromDict(caseId: string, fluidName: string) {
      const fluid = this.configFluids.find((item) => item.enabled && item.name === fluidName);
      if (!fluid) return;
      const payload = normalizeFluidFromDict(fluid, this.currentDoctorName);
      const withTime = { ...payload, startTime: dayjs().toISOString() };
      if (fluid.subCategory === '血液制品') {
        withTime.endTime = dayjs(withTime.startTime).add(LIVE_DEFAULT_SEGMENT_MINUTES, 'minute').toISOString();
      }
      this.appendFluid(caseId, withTime);
    },
    recordFieldChange(caseId: string, label: string, before: unknown, after: unknown, reason = '记录单字段修改') {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target) return;
      const beforeText = String(before ?? '');
      const afterText = String(after ?? '');
      if (beforeText === afterText) return;
      target.modificationLogs = target.modificationLogs ?? [];
      target.modificationLogs.unshift({
        id: `mod-${Date.now()}`,
        time: dayjs().toISOString(),
        operator: this.currentDoctorName,
        field: label,
        label,
        before: beforeText,
        after: afterText,
        reason,
        status: target.locked ? '已记录' : '录入修改',
      });
    },
    setCurrentDoctor(name: string) {
      this.currentDoctorName = name;
      appendAuditLog({ user: name, module: '登录医生视角', action: '切换', target: 'currentDoctor', detail: `切换当前麻醉医生为 ${name}` });
    },
    syncDataset() {
      syncAllClinicalToDataset(getMutableDataset(), this.cases, this.pacuPatients, this.followUps);
      bumpDatasetVersion();
      this.datasetVersion += 1;
    },
    setQualityCategory(category: '全部' | QualityCategory) {
      this.qualityFilter.category = category;
    },
    setQualityFilter(patch: Partial<QualityFilter>) {
      this.qualityFilter = { ...this.qualityFilter, ...patch };
    },
    setQuickPeriod(periodType: QualityFilter['periodType'], startMonth: string, endMonth: string) {
      this.qualityFilter.periodType = periodType;
      this.qualityFilter.startMonth = startMonth;
      this.qualityFilter.endMonth = endMonth;
    },
    setQualityDateRange(startMonth: string, endMonth: string) {
      this.qualityFilter.periodType = '自定义';
      this.qualityFilter.startMonth = startMonth;
      this.qualityFilter.endMonth = endMonth;
    },
    setSelectedIndicator(code: string) {
      this.selectedIndicatorCode = code;
    },
    toggleFavoriteIndicator(code: string) {
      this.favoriteIndicatorCodes = this.favoriteIndicatorCodes.includes(code)
        ? this.favoriteIndicatorCodes.filter((item) => item !== code)
        : [code, ...this.favoriteIndicatorCodes];
    },
    refreshQualityIndicators() {
      this.syncDataset();
      invalidateQualityCache();
      this.cacheCurrentQualityReport();
    },
    resetQualityFilter() {
      this.qualityFilter = defaultFilter();
    },
    exportQualityIndicators() {
      const csv = exportQualityCsv(this.indicatorDetails);
      downloadTextFile(`quality-indicators-${dayjs().format('YYYY-MM')}.csv`, csv);
      appendAuditLog({ user: '质控管理员', module: '麻醉质控', action: '导出', target: 'indicators', detail: '导出当前筛选指标 CSV' });
    },
    cacheCurrentQualityReport() {
      upsertQualityReportCache({
        period: `${this.qualityFilter.startMonth}~${this.qualityFilter.endMonth}`,
        hospitalId: 'h-001',
        generatedAt: dayjs().toISOString(),
        indicatorCount: this.indicatorDetails.length,
        defectCount: this.qualityDefects.length,
        exportFormat: 'excel',
      });
    },
    updateDefectStatus(defectId: string, patch: Partial<QualityDefect>) {
      this.defectOverrides[defectId] = { ...this.defectOverrides[defectId], ...patch, reviewTime: patch.status === '已整改' || patch.status === '已关闭' ? dayjs().toISOString() : this.defectOverrides[defectId]?.reviewTime };
      appendAuditLog({ user: '质控管理员', module: '质控缺陷', action: '状态更新', target: defectId, detail: `缺陷状态更新为 ${patch.status ?? ''}` });
    },
    upsertCase(payload: SurgeryCase) {
      const scheduledStart = payload.scheduledStart ?? payload.plannedStart;
      const enriched: SurgeryCase = {
        ...payload,
        patientId: payload.patientId ?? `patient-${payload.id}`,
        roomId: payload.roomId ?? payload.room,
        roomName: payload.roomName ?? payload.room,
        scheduledStart,
        scheduledEnd: payload.scheduledEnd ?? dayjs(scheduledStart).add(payload.expectedDurationMinutes || 60, 'minute').toISOString(),
        actualStart: payload.actualStart ?? payload.anesthesiaStart,
        assignedAnesthesiologistIds: payload.assignedAnesthesiologistIds?.length ? payload.assignedAnesthesiologistIds : [payload.anesthesiologist],
        assignedNurseIds: payload.assignedNurseIds?.length ? payload.assignedNurseIds : [payload.anesthesiaNurse],
        nursingScheduleSource: payload.nursingScheduleSource ?? '手术护理系统正式排班',
        emergencyInserted: payload.emergencyInserted ?? payload.urgency === '急诊',
      };
      const index = this.cases.findIndex((item) => item.id === payload.id);
      if (index >= 0) this.cases[index] = clone(enriched);
      else this.cases.push(clone(enriched));
      syncCaseToDataset(getMutableDataset(), enriched);
      bumpDatasetVersion();
      this.datasetVersion += 1;
    },
    createEmergencyCase(payload: SurgeryCase) {
      this.upsertCase({
        ...payload,
        urgency: '急诊',
        emergencyInserted: true,
        nursingScheduleSource: payload.nursingScheduleSource ?? '手术护理系统急诊插单',
      });
    },
    upsertPacuPatient(payload: PacuPatient) {
      const index = this.pacuPatients.findIndex((item) => item.id === payload.id);
      if (index >= 0) this.pacuPatients[index] = clone(payload);
      else this.pacuPatients.push(clone(payload));
      syncPacuToDataset(getMutableDataset(), payload);
      bumpDatasetVersion();
      this.datasetVersion += 1;
      appendAuditLog({ user: '复苏护士', module: 'PACU', action: '保存记录', target: payload.caseId, detail: `${payload.patientName} PACU 记录已保存` });
    },
    upsertFollowUp(payload: PostoperativeFollowUp) {
      const index = this.followUps.findIndex((item) => item.id === payload.id);
      if (index >= 0) this.followUps[index] = clone(payload);
      else this.followUps.push(clone(payload));
      syncFollowUpToDataset(getMutableDataset(), payload);
      bumpDatasetVersion();
      this.datasetVersion += 1;
    },
    stopMedication(caseId: string, medicationId: string, stopTime?: string) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked) return;
      const med = target.medications.find((item) => item.id === medicationId);
      if (med) med.stopTime = stopTime ?? dayjs().toISOString();
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
    },
    updateRescueRecord(caseId: string, patch: Partial<RescueRecord>) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked || !target.rescue) return;
      target.rescue = { ...target.rescue, ...patch };
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
    },
    lockRecord(caseId: string) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target) return;
      target.locked = true;
      appendAuditLog({ user: '质控管理员', module: '麻醉记录单', action: '锁定', target: caseId, detail: '记录单打印后锁定' });
    },
    unlockRecord(caseId: string, reason: string) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target) return;
      target.locked = false;
      target.recordStatus = '补记中';
      if (target.signatures) target.signatures.status = '修改中';
      appendAuditLog({ user: '质控管理员', module: '麻醉记录单', action: '解锁', target: caseId, detail: reason });
    },
    applyTemplateLandingItem(caseId: string, item: TemplateLandingItem) {
      const target = this.cases.find((entry) => entry.id === caseId);
      if (!target || target.locked) return;
      if (item.kind === 'event' && item.event) {
        const event = buildLandingEvent(item, target);
        target.events.push(event);
        applyLandingSyncFields(target, event);
      }
      if (item.kind === 'medication' && item.medication) {
        this.appendMedication(caseId, buildLandingMedication(item, target));
      }
      if (item.kind === 'monitor' && item.monitorCode) {
        const draft = (this.recordDrafts[caseId] && typeof this.recordDrafts[caseId] === 'object')
          ? this.recordDrafts[caseId] as Record<string, unknown>
          : {};
        const current = Array.isArray(draft.monitorOrder) ? draft.monitorOrder as string[] : [];
        this.saveMonitorOrderDraft(caseId, mergeMonitorCodes(current, [item.monitorCode]));
      }
      if (item.kind === 'field') applyProfessionalFieldLanding(target, item);
      target.operationLogs = [`确认落单：${item.label}`, ...(target.operationLogs ?? [])].slice(0, 8);
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
    },
    saveProfessionalField(caseId: string, group: string, label: string, value: string) {
      const target = this.cases.find((entry) => entry.id === caseId);
      if (!target || target.locked) return;
      const key = `${group}::${label}`;
      const before = target.professionalFieldValues?.[key] ?? '';
      target.professionalFieldValues = { ...(target.professionalFieldValues ?? {}), [key]: value };
      this.recordFieldChange(caseId, '专业字段', before, value, `${group}/${label}`);
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
    },
    applyTimelineNode(caseId: string, node: MethodTimelineNode, isoTime: string): number {
      const target = this.cases.find((entry) => entry.id === caseId);
      if (!target || target.locked) return this.recordPageDrafts[caseId] ?? 1;
      applyTimelineNodeTime(target, node, isoTime);
      const clock = dayjs(isoTime).format('HH:mm');
      if (!target.recordSummary) target.recordSummary = {};
      if (!target.recordSummary.notes) target.recordSummary.notes = {};
      target.recordSummary.notes.keyOperations = upsertTimedKeyOperationLine(
        target.recordSummary.notes.keyOperations,
        node.label,
        clock,
      );
      this.recordFieldChange(caseId, '关键时间', '', `${node.label} ${isoTime}`, '时间轴节点');
      this.syncRecordDocument(caseId);
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
      if (node.key === 'room-in' || node.syncField === 'roomInTime') {
        return this.focusRecordPageByTime(caseId, isoTime);
      }
      return this.recordPageDrafts[caseId] ?? 1;
    },
    handleAbnormalVital(caseId: string, vitalKey: string, metric: string, treatment: string) {
      const target = this.cases.find((entry) => entry.id === caseId);
      if (!target || target.locked) return;
      const row = target.vitals.find((item) => item.id === vitalKey)
        ?? target.vitals.find((item) => item.time === vitalKey);
      if (!row) return;
      row.abnormalHandled = { ...(row.abnormalHandled ?? {}), [metric]: treatment };
      row.remark = [row.remark, `${metric}处置：${treatment}`].filter(Boolean).join('；');
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
    },
    cancelCase(id: string) {
      const target = this.cases.find((item) => item.id === id);
      if (!target || target.locked) return;
      target.status = '已取消';
      target.events.push({
        id: `event-${Date.now()}`,
        type: target.anesthesiaStart ? '麻醉开始后手术取消' : '入室后取消',
        time: dayjs().toISOString(),
        stage: target.anesthesiaStart ? '诱导期' : '入室后',
        severity: '中度',
        treatment: '前端模拟取消手术，需补充取消原因。',
        staff: [target.anesthesiologist],
        reported: false,
        qualityIncluded: true,
      });
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
    },
    appendEvent(caseId: string, event: Omit<AnesthesiaEvent, 'id' | 'time' | 'staff' | 'reported' | 'qualityIncluded'> & Partial<AnesthesiaEvent>) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked) return;
      const defaultTime = resolveRecordSheetNowIso(target);
      target.events.push({
        id: `event-${Date.now()}`,
        time: defaultTime,
        staff: [target.anesthesiologist, target.anesthesiaNurse],
        reported: false,
        qualityIncluded: ['低血压', '高血压', '低氧', '低体温', '困难气道', '反流误吸', '严重过敏', '心脏骤停', '牙齿损伤', '非计划转ICU', '非计划二次插管', '抢救'].includes(event.type),
        ...event,
      });
      if (event.type === '抢救') {
        this.rescueModeCaseId = caseId;
        target.vitalFrequency = '抢救1分钟';
        if (!isRescueModeActive(target)) {
          const startTime = event.time ?? dayjs().toISOString();
          target.rescue = {
            startTime,
            measures: event.treatment || '请补记抢救措施、复苏过程和会诊情况。',
            medications: '',
            participants: [target.anesthesiologist, target.anesthesiaNurse].filter(Boolean) as string[],
            supplementReminder: true,
          };
        }
      }
      if (event.type === '抢救结束' && target.rescue && !target.rescue.endTime) {
        target.rescue = {
          ...target.rescue,
          endTime: event.time ?? dayjs().toISOString(),
          result: event.treatment,
          supplementReminder: true,
        };
        if (target.vitalFrequency === '抢救1分钟') target.vitalFrequency = '5分钟';
        if (this.rescueModeCaseId === caseId) this.rescueModeCaseId = '';
      }
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
      this.afterRecordMutation(caseId, { entityType: 'timeline_event', entityLocalId: target.events[target.events.length - 1]?.id, operationType: 'create', apiPath: '/api-samis/pc/v1/anesthesiaRecord/saveTimelineEvent' });
    },
    appendVital(caseId: string, vital: VitalSign) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked) return;
      target.vitals.push(vital);
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
      this.afterRecordMutation(caseId, { entityType: 'vital_sign', entityLocalId: vital.id, operationType: 'create', apiPath: '/api-samis/pc/v1/anesthesiaRecord/batchSaveVitalSigns' });
    },
    upsertVital(caseId: string, vital: VitalSign) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked) return;
      const row = { ...vital, id: vital.id ?? `vital-${Date.now()}` };
      const index = findVitalUpsertIndex(target.vitals, vital);
      if (index >= 0) target.vitals[index] = row;
      else target.vitals.push(row);
      target.vitals.sort((a, b) => a.time.localeCompare(b.time));
      this.recordFieldChange(caseId, '生命体征', index >= 0 ? '编辑监测记录' : '', `${row.time}`, '右键/列表维护');
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
      this.afterRecordMutation(caseId, { entityType: 'vital_sign', entityLocalId: row.id, operationType: index >= 0 ? 'update' : 'create', apiPath: '/api-samis/pc/v1/anesthesiaRecord/batchSaveVitalSigns' });
    },
    deleteVital(caseId: string, vitalId: string) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked) return;
      const before = target.vitals.length;
      target.vitals = target.vitals.filter((item) => item.id !== vitalId);
      if (target.vitals.length !== before) this.recordFieldChange(caseId, '生命体征', vitalId, '已删除', '右键/列表删除');
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
      this.afterRecordMutation(caseId, { entityType: 'vital_sign', entityLocalId: vitalId, operationType: 'delete', apiPath: '/api-samis/pc/v1/anesthesiaRecord/batchSaveVitalSigns' });
    },
    appendMedication(caseId: string, medication: Omit<MedicationRecord, 'id'>) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked) return;
      target.medications.push({ id: `med-${Date.now()}`, ...medication });
      applySpecialNumbersToMedications(target.medications);
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
      this.afterRecordMutation(caseId, { entityType: 'medication', entityLocalId: target.medications[target.medications.length - 1]?.id, operationType: 'create', apiPath: '/api-samis/pc/v1/anesthesiaRecord/saveMedication' });
    },
    upsertMedication(caseId: string, medication: MedicationRecord) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked) return;
      const row = { ...medication, id: medication.id || `med-${Date.now()}` };
      const index = target.medications.findIndex((item) => item.id === row.id);
      const before = index >= 0 ? target.medications[index]?.drug : '';
      if (index >= 0) target.medications[index] = row;
      else target.medications.push(row);
      applySpecialNumbersToMedications(target.medications);
      this.recordFieldChange(caseId, '用药记录', before, `${row.drug}${row.dose ?? ''}${row.unit ?? ''}`, '右键/列表维护');
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
      this.afterRecordMutation(caseId, { entityType: 'medication', entityLocalId: row.id, operationType: index >= 0 ? 'update' : 'create', apiPath: '/api-samis/pc/v1/anesthesiaRecord/saveMedication' });
    },
    deleteMedication(caseId: string, medicationId: string) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked) return;
      const before = target.medications.find((item) => item.id === medicationId)?.drug;
      target.medications = target.medications.filter((item) => item.id !== medicationId);
      this.recordFieldChange(caseId, '用药记录', before, '已删除', '右键/列表删除');
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
      this.afterRecordMutation(caseId, { entityType: 'medication', entityLocalId: medicationId, operationType: 'delete', apiPath: '/api-samis/pc/v1/anesthesiaRecord/deleteMedication' });
    },
    appendFluid(caseId: string, fluid: Omit<FluidRecord, 'id'>) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked) return;
      target.fluids.push({ id: `fluid-${Date.now()}`, ...fluid });
      this.syncRecordDocument(caseId);
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
    },
    upsertFluid(caseId: string, fluid: FluidRecord) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked) return;
      const row = { ...fluid, id: fluid.id || `fluid-${Date.now()}` };
      const index = target.fluids.findIndex((item) => item.id === row.id);
      const before = index >= 0 ? target.fluids[index]?.name : '';
      if (index >= 0) target.fluids[index] = row;
      else target.fluids.push(row);
      this.recordFieldChange(caseId, row.category === '血液制品' ? '输血记录' : '输液记录', before, `${row.name}${row.volume}${row.unit ?? ''}`, '右键/列表维护');
      this.syncRecordDocument(caseId);
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
    },
    deleteFluid(caseId: string, fluidId: string) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked) return;
      const before = target.fluids.find((item) => item.id === fluidId)?.name;
      target.fluids = target.fluids.filter((item) => item.id !== fluidId);
      this.recordFieldChange(caseId, '输液/输血记录', before, '已删除', '右键/列表删除');
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
    },
    upsertOutputRecord(caseId: string, output: OutputDetailRecord) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked) return;
      target.outputRecords = target.outputRecords ?? [];
      const row = { ...output, id: output.id || `output-${Date.now()}` };
      const index = target.outputRecords.findIndex((item) => item.id === row.id);
      const before = index >= 0 ? `${target.outputRecords[index].type}${target.outputRecords[index].volume}` : '';
      if (index >= 0) target.outputRecords[index] = row;
      else target.outputRecords.push(row);
      recalculateOutputs(target);
      this.recordFieldChange(caseId, '出入量', before, `${row.type}${row.volume}ml`, '右键/列表维护');
      this.syncRecordDocument(caseId);
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
    },
    deleteOutputRecord(caseId: string, outputId: string) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked) return;
      const before = target.outputRecords?.find((item) => item.id === outputId);
      target.outputRecords = (target.outputRecords ?? []).filter((item) => item.id !== outputId);
      recalculateOutputs(target);
      this.recordFieldChange(caseId, '出入量', before ? `${before.type}${before.volume}` : outputId, '已删除', '右键/列表删除');
      this.syncRecordDocument(caseId);
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
    },
    upsertAnesthesiaPlane(caseId: string, plane: AnesthesiaPlaneRecord) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked) return;
      target.anesthesiaPlanes = target.anesthesiaPlanes ?? [];
      const row = { ...plane, id: plane.id || `plane-${Date.now()}` };
      const index = target.anesthesiaPlanes.findIndex((item) => item.id === row.id);
      const before = index >= 0 ? `${target.anesthesiaPlanes[index].level}${target.anesthesiaPlanes[index].direction}` : '';
      if (index >= 0) target.anesthesiaPlanes[index] = row;
      else target.anesthesiaPlanes.push(row);
      target.anesthesiaPlanes.sort((a, b) => a.time.localeCompare(b.time));
      this.recordFieldChange(caseId, '麻醉平面', before, `${row.level}${row.direction}`, '右键/列表维护');
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
    },
    deleteAnesthesiaPlane(caseId: string, planeId: string) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked) return;
      const before = target.anesthesiaPlanes?.find((item) => item.id === planeId);
      target.anesthesiaPlanes = (target.anesthesiaPlanes ?? []).filter((item) => item.id !== planeId);
      this.recordFieldChange(caseId, '麻醉平面', before ? `${before.level}${before.direction}` : planeId, '已删除', '右键/列表删除');
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
    },
    syncRecordDocument(caseId: string) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target) return;
      const intervals = resolveTimeAxisIntervals(target);
      const doc = ensureRecordDocument(target);
      const { pages } = buildRecordPagination(target, {
        minorInterval: intervals.minorInterval,
        majorInterval: intervals.majorInterval,
      });
      target.recordDocument = {
        ...doc,
        minorInterval: intervals.minorInterval,
        majorInterval: intervals.majorInterval,
        hospitalName: doc.hospitalName || DEFAULT_HOSPITAL_NAME,
        pageCount: pages.length,
        timeAxisPages: pages,
      };
      target.transfusionEvents = syncTransfusionEventsFromFluids(target);
      target.recordSummary = buildRecordSummaryFields(target);
      this.afterRecordMutation(caseId, { entityType: 'record', entityLocalId: caseId, operationType: 'update', apiPath: '/api-samis/pc/v1/anesthesiaRecord/saveRecord' });
    },
    upsertLabResult(caseId: string, lab: LabResultRecord) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked) return;
      target.labResults = target.labResults ?? [];
      const row = { ...lab, id: lab.id || `lab-${Date.now()}` };
      const index = target.labResults.findIndex((item) => item.id === row.id);
      const before = index >= 0 ? target.labResults[index].labType : '';
      if (index >= 0) target.labResults[index] = row;
      else target.labResults.push(row);
      this.recordFieldChange(caseId, '血气/检验', before, `${row.labType} ${row.resultTime}`, '右键/趋势图维护');
      this.syncRecordDocument(caseId);
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
    },
    voidEvent(caseId: string, eventId: string, reason = '事件作废') {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked) return;
      const event = target.events.find((item) => item.id === eventId);
      if (!event) return;
      event.status = 'voided';
      event.voidReason = reason;
      this.recordFieldChange(caseId, '事件作废', event.type, '已作废', reason);
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
    },
    // 作废/撤销作废：医疗记录不做物理删除，统一以状态标记保留原始数据并留痕。
    setRecordVoidState(
      caseId: string,
      kind: 'medication' | 'fluid' | 'vital' | 'output' | 'plane',
      id: string,
      voided: boolean,
      reason = voided ? '右键作废' : '撤销作废',
    ) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked || !id) return;
      const nextStatus: 'active' | 'voided' = voided ? 'voided' : 'active';
      const stamp = (entry: { status?: string; voidReason?: string; voidedAt?: string }, label: string, name: string) => {
        entry.status = nextStatus;
        entry.voidReason = voided ? reason : undefined;
        entry.voidedAt = voided ? dayjs().toISOString() : undefined;
        this.recordFieldChange(caseId, label, name, voided ? '已作废' : '已撤销作废', reason);
      };
      if (kind === 'medication') {
        const row = target.medications.find((item) => item.id === id);
        if (!row) return;
        stamp(row, '用药记录', `${row.drug}${row.dose ?? ''}${row.unit ?? ''}`);
      } else if (kind === 'fluid') {
        const row = target.fluids.find((item) => item.id === id);
        if (!row) return;
        stamp(row, row.category === '血液制品' ? '输血记录' : '输液记录', `${row.name}${row.volume}${row.unit ?? ''}`);
      } else if (kind === 'vital') {
        const row = target.vitals.find((item) => item.id === id);
        if (!row) return;
        stamp(row, '生命体征', isoOrClockToClock(row.time));
      } else if (kind === 'output') {
        const row = (target.outputRecords ?? []).find((item) => item.id === id);
        if (!row) return;
        stamp(row, '出入量', `${row.type}${row.volume}ml`);
        recalculateOutputs(target);
      } else if (kind === 'plane') {
        const row = (target.anesthesiaPlanes ?? []).find((item) => item.id === id);
        if (!row) return;
        stamp(row, '麻醉平面', `${row.level}${row.direction}`);
      }
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
      this.afterRecordMutation(caseId, { entityType: kind === 'fluid' ? 'fluid' : kind === 'vital' ? 'vital_sign' : kind === 'output' ? 'io_record' : 'medication', entityLocalId: id, operationType: voided ? 'void' : 'update' });
    },
    voidRecord(
      caseId: string,
      kind: 'medication' | 'fluid' | 'vital' | 'output' | 'plane',
      id: string,
      reason = '右键作废',
    ) {
      this.setRecordVoidState(caseId, kind, id, true, reason);
    },
    restoreRecord(
      caseId: string,
      kind: 'medication' | 'fluid' | 'vital' | 'output' | 'plane',
      id: string,
      reason = '撤销作废',
    ) {
      this.setRecordVoidState(caseId, kind, id, false, reason);
    },
    setLayoutWarnings(caseId: string, warnings: LayoutWarning[]) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target) return;
      target.layoutWarnings = warnings;
    },
    updateRecordSummary(caseId: string, patch: Partial<RecordSummaryFields>, reason = '汇总修正') {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked) return;
      const before = JSON.stringify(target.recordSummary ?? {});
      target.recordSummary = { ...buildRecordSummaryFields(target), ...patch };
      this.recordFieldChange(caseId, '底部汇总', before, JSON.stringify(target.recordSummary), reason);
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
    },
    updateRecordHeaderField(
      caseId: string,
      patch: {
        actualSurgeryName?: string;
        position?: string;
        anesthesiologist?: string;
        surgeon?: string;
        anesthesiaNurse?: string;
        circulatingNurses?: string;
        scrubNurses?: string;
        anesthesiaMethod?: string;
      },
      reason = '表头修正',
    ) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked) return;
      if (patch.actualSurgeryName !== undefined) {
        const before = target.actualSurgeryName ?? target.surgeryName;
        target.actualSurgeryName = patch.actualSurgeryName;
        this.recordFieldChange(caseId, '实施手术', before, patch.actualSurgeryName, reason);
      }
      if (patch.position !== undefined) {
        const before = target.position ?? '';
        target.position = patch.position;
        this.recordFieldChange(caseId, '手术体位', before, patch.position, reason);
      }
      if (patch.anesthesiologist !== undefined) {
        const before = target.anesthesiologist;
        target.anesthesiologist = patch.anesthesiologist;
        target.assignedAnesthesiologistIds = patch.anesthesiologist.split('、').map((item) => item.trim()).filter(Boolean);
        this.recordFieldChange(caseId, '麻醉医师', before, patch.anesthesiologist, reason);
      }
      if (patch.surgeon !== undefined) {
        const before = target.surgeon;
        target.surgeon = patch.surgeon;
        this.recordFieldChange(caseId, '手术医师', before, patch.surgeon, reason);
      }
      if (patch.circulatingNurses !== undefined) {
        const before = target.circulatingNurses ?? target.anesthesiaNurse;
        target.circulatingNurses = patch.circulatingNurses;
        target.anesthesiaNurse = [patch.circulatingNurses, target.scrubNurses].filter(Boolean).join(' / ') || patch.circulatingNurses;
        target.assignedNurseIds = [
          ...patch.circulatingNurses.split('、').map((item) => item.trim()).filter(Boolean),
          ...(target.scrubNurses?.split('、').map((item) => item.trim()).filter(Boolean) ?? []),
        ];
        this.recordFieldChange(caseId, '巡回护士', before, patch.circulatingNurses, reason);
      }
      if (patch.scrubNurses !== undefined) {
        const before = target.scrubNurses ?? '';
        target.scrubNurses = patch.scrubNurses;
        target.anesthesiaNurse = [target.circulatingNurses, patch.scrubNurses].filter(Boolean).join(' / ') || target.anesthesiaNurse;
        target.assignedNurseIds = [
          ...(target.circulatingNurses?.split('、').map((item) => item.trim()).filter(Boolean) ?? []),
          ...patch.scrubNurses.split('、').map((item) => item.trim()).filter(Boolean),
        ];
        this.recordFieldChange(caseId, '洗手护士', before, patch.scrubNurses, reason);
      }
      if (patch.anesthesiaNurse !== undefined) {
        const before = target.anesthesiaNurse;
        target.anesthesiaNurse = patch.anesthesiaNurse;
        target.circulatingNurses = patch.anesthesiaNurse;
        target.assignedNurseIds = patch.anesthesiaNurse.split('、').map((item) => item.trim()).filter(Boolean);
        this.recordFieldChange(caseId, '巡回/洗手', before, patch.anesthesiaNurse, reason);
      }
      if (patch.anesthesiaMethod !== undefined) {
        const before = target.anesthesiaMethod;
        target.anesthesiaMethod = patch.anesthesiaMethod;
        this.recordFieldChange(caseId, '麻醉方法', before, patch.anesthesiaMethod, reason);
      }
      target.recordSnapshot = buildRecordSnapshot(target, target.recordDocument?.hospitalName);
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
    },
    updateRecordSummaryNotes(caseId: string, patch: Partial<RecordSummaryNotes>, reason = '纸面摘要修正') {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked) return;
      const base = buildRecordSummaryFields(target);
      target.recordSummary = {
        ...base,
        notes: { ...(base.notes ?? {}), ...(target.recordSummary?.notes ?? {}), ...patch },
      };
      this.recordFieldChange(caseId, '纸面摘要', JSON.stringify(target.recordSummary?.notes ?? {}), JSON.stringify(patch), reason);
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
    },
    printAndLockRecord(caseId: string, reason = '打印确认') {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target) return false;
      this.syncRecordDocument(caseId);
      target.recordSnapshot = buildRecordSnapshot(target, target.recordDocument?.hospitalName);
      const printedAt = dayjs().toISOString();
      target.printedAt = printedAt;
      target.recordDocument = {
        ...(target.recordDocument ?? ensureRecordDocument(target)),
        printedAt,
        lockedAt: printedAt,
        printVersion: (target.recordDocument?.printVersion ?? 0) + 1,
      };
      target.recordSummary = {
        ...buildRecordSummaryFields(target),
        completedAt: printedAt,
      };
      target.locked = true;
      target.recordStatus = '已锁定';
      this.recordFieldChange(caseId, '打印锁定', '未锁定', '已打印锁定', reason);
      appendAuditLog({ user: this.currentDoctorName, module: '麻醉记录单', action: '打印锁定', target: caseId, detail: reason });
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
      this.afterRecordMutation(caseId, { entityType: 'record', entityLocalId: caseId, operationType: 'lock', apiPath: '/api-samis/pc/v1/anesthesiaRecord/lockRecord' });
      return true;
    },
    importDeviceVitalsLayered(caseId: string) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked) return;
      const last = target.vitals[target.vitals.length - 1];
      if (!last) return;
      const now = dayjs().toISOString();
      const original: Record<string, number | string> = {};
      (['HR', 'SBP', 'DBP', 'SpO2', 'EtCO2', 'TEMP'] as const).forEach((key) => {
        const value = last[key];
        if (value !== undefined) original[key] = value;
      });
      const vital: VitalSign = {
        ...last,
        time: now,
        source: '设备采集',
        originalValue: original,
        displayValue: { ...original },
        remark: '设备采集模拟',
      };
      const upsertIndex = findVitalUpsertIndex(target.vitals, vital);
      if (upsertIndex >= 0) {
        vital.id = target.vitals[upsertIndex].id;
        target.vitals[upsertIndex] = vital;
      } else {
        vital.id = `vital-${Date.now()}`;
        target.vitals.push(vital);
      }
      target.vitals.sort((a, b) => a.time.localeCompare(b.time));
      if (target.device) {
        target.device.lastCollectTime = now;
        target.device.collectStatus = '采集中';
        target.device.logs.unshift({ time: now, content: '监护仪数据已写入记录单' });
      }
      this.syncRecordDocument(caseId);
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
    },
    upsertDictList(listKey: 'configRooms' | 'configEvents' | 'configScores' | 'configPrintTemplates' | 'configStaff', values: string[]) {
      this[listKey] = values;
    },
    upsertMethodCategories(categories: AnesthesiaMethodCategory[]) {
      this.configMethods = clone(categories);
    },
    upsertDrugDict(items: DrugDictItem[]) {
      this.configDrugs = clone(items);
      this.persistRecordLocalState();
    },
    async saveDrugDictEntry(item: DrugDictItem): Promise<boolean> {
      const saved = await persistDrugDictItem(item);
      if (!saved) return false;
      const next = clone(this.configDrugs);
      const index = next.findIndex(
        (row) => row.id === item.id || (saved.id && row.id === saved.id),
      );
      if (index >= 0) next[index] = saved;
      else next.push(saved);
      next.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
      this.configDrugs = next;
      this.persistRecordLocalState();
      return true;
    },
    async disableDrugDictEntry(drugId: string | number): Promise<boolean> {
      const ok = await disableDrugDictItem(drugId);
      if (!ok) return false;
      this.configDrugs = this.configDrugs.filter(
        (row) => row.id !== drugId && String(row.id) !== String(drugId),
      );
      this.persistRecordLocalState();
      return true;
    },
    upsertFluidBloodDict(items: FluidBloodDictItem[]) {
      this.configFluids = clone(items);
      this.persistRecordLocalState();
    },
    upsertVitalSignDict(items: VitalSignDictItem[]) {
      this.configVitals = clone(items);
      this.persistRecordLocalState();
    },
    upsertGenericDict(key: string, values: string[]) {
      this.configGenericDicts[key] = values;
      this.persistRecordLocalState();
    },
    savePdcaRecord(record: PdcaRecord) {
      const index = this.pdcaRecords.findIndex((item) => item.id === record.id);
      if (index >= 0) this.pdcaRecords[index] = record;
      else this.pdcaRecords.unshift(record);
    },
    saveSystemUser(user: Parameters<typeof upsertSystemUser>[0]) {
      upsertSystemUser(user);
    },
    saveIntegration(id: string, patch: Parameters<typeof updateIntegrationEndpoint>[1]) {
      updateIntegrationEndpoint(id, patch);
    },
    triggerIntegrationSync(id: string) {
      updateIntegrationEndpoint(id, { lastSync: dayjs().toISOString(), status: 'simulated' });
      appendAuditLog({ user: '系统管理员', module: '接口集成', action: '同步', target: id, detail: '触发模拟同步' });
    },
    saveConsentRecord(record: ConsentRecord) {
      const index = this.consentRecords.findIndex((item) => item.id === record.id);
      if (index >= 0) this.consentRecords[index] = { ...record, updatedAt: dayjs().toISOString() };
      else this.consentRecords.unshift(record);
    },
    saveHandoverRecord(record: HandoverRecord) {
      const index = this.handoverRecords.findIndex((item) => item.id === record.id);
      if (index >= 0) this.handoverRecords[index] = record;
      else this.handoverRecords.unshift(record);
    },
    saveSummaryRecord(record: SummaryRecord) {
      const index = this.summaryRecords.findIndex((item) => item.id === record.id);
      if (index >= 0) this.summaryRecords[index] = record;
      else this.summaryRecords.unshift(record);
    },
    confirmWorkflowMilestone(caseId: string, milestone: WorkflowMilestoneKey, checklist: Record<string, boolean>) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked) return;
      const now = dayjs().toISOString();
      const fieldMap: Partial<Record<WorkflowMilestoneKey, keyof SurgeryCase>> = {
        surgeryStart: 'surgeryStart',
        roomIn: 'roomInTime',
        anesthesiaStart: 'anesthesiaStart',
        surgeryEnd: 'surgeryEnd',
        anesthesiaEnd: 'anesthesiaEnd',
        roomOut: 'leaveRoomTime',
      };
      const field = fieldMap[milestone];
      if (field) (target as Record<string, unknown>)[field] = now;
      if (milestone === 'pacuIn') target.status = 'PACU';
      if (milestone === 'orOut') target.transferTo = target.transferTo ?? 'PACU';
      target.operationLogs = [...(target.operationLogs ?? []), `${milestone} 确认 ${now} ${JSON.stringify(checklist)}`];
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
    },
    receivePacuPatient(payload: Omit<PacuReceiveRecord, 'id' | 'status' | 'receiveTime'>) {
      const bed = this.pacuRooms.flatMap((r) => r.beds).find((b) => b.id === payload.bedId);
      if (bed) {
        bed.status = '占用';
        bed.caseId = payload.caseId;
        bed.patientName = payload.patientName;
        bed.inTime = dayjs().toISOString();
      }
      const record: PacuReceiveRecord = {
        ...payload,
        id: `receive-${payload.caseId}-${Date.now()}`,
        receiveTime: dayjs().toISOString(),
        status: '已接收',
      };
      this.pacuReceives.unshift(record);
      const target = this.cases.find((item) => item.id === payload.caseId);
      if (target) {
        target.status = 'PACU';
        syncCaseToDataset(getMutableDataset(), target);
        bumpDatasetVersion();
        this.datasetVersion += 1;
      }
    },
    updateTodoStatus(todoId: string, status: TodoItem['status']) {
      this.todoOverrides[todoId] = status;
    },
    saveComplication(record: ComplicationRecord) {
      const index = this.complications.findIndex((item) => item.id === record.id);
      if (index >= 0) this.complications[index] = record;
      else this.complications.unshift(record);
    },
    addFavorite(item: Omit<FavoriteItem, 'id' | 'createdAt'>) {
      this.favorites.unshift({ ...item, id: `fav-${Date.now()}`, createdAt: dayjs().toISOString() });
    },
    removeFavorite(id: string) {
      this.favorites = this.favorites.filter((item) => item.id !== id);
    },
    savePacuBooking(booking: PacuBooking) {
      const index = this.pacuBookings.findIndex((item) => item.id === booking.id);
      if (index >= 0) this.pacuBookings[index] = booking;
      else this.pacuBookings.unshift(booking);
    },
    resolveEmergencyCall(id: string) {
      const target = this.emergencyCalls.find((item) => item.id === id);
      if (target) target.status = '已解决';
    },
    exportWorkloadCsv() {
      const stats = this.workloadStats ?? buildWorkloadStats(this.cases);
      const lines = [
        '指标,数值',
        `手术总数,${stats.totalSurgeries}`,
        `麻醉总数,${stats.totalAnesthesia}`,
        `急诊,${stats.emergencyCount}`,
        `择期,${stats.electiveCount}`,
        `完成率,${stats.completionRate}%`,
      ];
      downloadTextFile(`workload-${dayjs().format('YYYY-MM-DD')}.csv`, lines.join('\n'));
    },
    refreshClinicalModules() {
      this.consentRecords = buildConsentRecords(this.cases);
      this.pacuRooms = buildPacuRooms(this.cases);
      this.workloadStats = buildWorkloadStats(this.cases);
      this.monitorDevices = buildMonitorDevices(this.cases);
      this.monitorAlerts = buildMonitorAlerts(this.cases);
    },
  },
});

export type DictListKey = 'configRooms' | 'configEvents' | 'configScores' | 'configPrintTemplates' | 'configStaff';

export function dictItemsFromList(list: string[], prefix: string): DictItem[] {
  return list.map((name, index) => ({ id: `${prefix}-${index}`, code: name, name, enabled: true }));
}
