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
import { validateRecordEnd } from '@/services/anesthesia/recordActionRules';
import { submitRecordForSignature } from '@/services/anesthesia/recordLifecycleClient';
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
import { buildQualityScopeMeta, calculateIndicatorDetails, mergeRemoteIndicatorDetail } from '@/services/qualityCalculator';
import { applyDefectOverrides, detectQualityDefects } from '@/services/qualityDefectRules';
import {
  getDoctorCases,
  groupCasesByRoom,
  isCaseAssignedToDoctor,
  normalizeCaseSchedule,
  sortCasesByClinicalPriority,
  dedupeCasesByOperationId,
} from '@/services/scheduleHelpers';
import {
  applyTimelineNodeTime,
  clearTimelineNodeTime,
  type MethodTimelineNode,
} from '@/services/methodTimelineEngine';
import { upsertTimedKeyOperationLine, removeTimedKeyOperationLine } from '@/utils/numberedNotes';
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
  PrintTemplateItem,
  PdcaRecord,
  StaffDictItem,
  SystemUser,
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
  fetchOperationCaseById,
  fetchOperationList,
  fetchTodayWorkbench,
  hydrateCaseFromOperationInfo as hydrateCaseFromOperationInfoService,
} from '@/services/anesthesia/operationInfoService';
import type { WorkbenchRoomStatus, WorkbenchSummary } from '@/services/anesthesia/adapters/operationInfoAdapter';
import { loadRoomCatalog } from '@/services/anesthesia/roomService';
import {
  disableDrugDictItem,
  loadDrugDictCatalog,
  persistDrugDictItem,
} from '@/services/anesthesia/anesthesiaDictService';
import {
  disableDictListItem,
  disableFluidDictItem,
  disableStaffItem,
  disableTemplateItem,
  disableVitalDictItem,
  loadDictListByCategory,
  loadFluidDictCatalog,
  loadMethodTree,
  loadRoomNameCatalog,
  loadStaffCatalog,
  loadTemplateCatalog,
  loadVitalDictCatalog,
  persistDictListItem,
  persistFluidDictItem,
  persistStaffItem,
  persistTemplateItem,
  persistVitalDictItem,
} from '@/services/anesthesia/anesthesiaDictConfigService';
import { useRealOperationInfo, useRealAnesthesiaDict, useRealPacu, useRealQuality, useRealAdmin } from '@/config/apiFlags';
import {
  admitPacuPatient,
  loadRemotePacuList,
  transferOutPacuPatient,
  updatePacuRecordRemote,
  loadRemotePacuBookings,
  createPacuBookingRemote,
  updatePacuBookingRemote,
  cancelPacuBookingRemote,
  loadRemotePacuBeds,
  type PacuBedStatsApi,
} from '@/services/anesthesia/pacuService';
import {
  loadHypothermiaCases,
  loadAdverseEvents,
  loadIndicators,
  loadIndicatorDetail,
  loadQualityChecks,
  createQualityCheckRemote,
  updateQualityCheckRemote,
  deleteQualityCheckRemote,
  type QualityCheckInput,
  type QualityCheckPatch,
} from '@/services/anesthesia/qualityAggregatorService';
import {
  loadAdminUsers,
  loadAdminUserGroups,
  loadMenuTree,
  createAdminUserRemote,
  updateAdminUserRemote,
  deleteAdminUserRemote,
  changePasswordRemote,
  type AdminUserInput,
} from '@/services/anesthesia/adminAggregatorService';
import type {
  AdminUserGroupApi,
  AdminMenuNodeApi,
} from '@/api/adminUser';
import type {
  QualityHypothermiaResultApi,
  QualityAdverseEventResultApi,
  QualityCheckApi,
  QualityIndicatorApi,
  QualityIndicatorDetailApi,
} from '@/api/quality';
import {
  loadRemoteFollowups,
  upsertFollowupRemote,
  deleteFollowupRemote,
  loadRemoteComplications,
  upsertComplicationRemote,
  deleteComplicationRemote,
  loadRemoteAnalgesiaCases,
  loadRemoteUnplannedCases,
} from '@/services/anesthesia/postoperativeService';
import {
  loadRemoteRequests,
  loadRemoteConsultations,
  loadRemoteExamReviews,
  loadRemoteConsentRecords,
  loadRemoteSafetyChecks,
  upsertConsultationRemote,
  upsertExamReviewRemote,
  upsertConsentRemote,
  upsertSafetyCheckRemote,
  receiveRequestRemote,
  cancelRequestRemote,
  submitConsentRemote,
  submitConsultationRemote,
  cancelConsultationRemote,
  withdrawConsentRemote,
  markConsentPrintedRemote,
  fetchConsentByCaseId,
  fetchSafetyCheckByCaseId,
} from '@/services/anesthesia/preoperativeService';
import { useRealPreoperative } from '@/config/apiFlags';
import type { RoomGroupCatalog } from '@/services/anesthesia/adapters/roomAdapter';
import {
  hydrateAnesthesiaCasesFromLocalDb,
  persistCaseNow,
  restoreSingleCase,
  schedulePersistCase,
} from '@/services/anesthesia/anesthesiaPersistenceBridge';
import {
  patchRecordDeviceCollectMeta,
  saveDeviceVitalOnly,
  loadAllCasesFromLocalDb,
} from '@/services/anesthesia/anesthesiaRecordRepository';
import { reloadCaseFromServer } from '@/services/anesthesia/anesthesiaRecordHydrate';
import {
  patchAnesthesiaSyncUiState,
  setAnesthesiaSyncRecordScope,
  startAnesthesiaSyncService,
  subscribeAnesthesiaSyncState,
  syncStatesEqual,
} from '@/services/anesthesia/anesthesiaSyncService';
import { ANESTHESIA_SYNC_QUEUE_API_PATH } from '@/services/anesthesia/anesthesiaSyncQueue';
import { startMonitorMockService, readMonitorDisplayIntervalMinutes, type MonitorMockHandle } from '@/services/anesthesia/monitorMockService';
import { startVentilatorMockService, type VentilatorMockHandle } from '@/services/anesthesia/ventilatorMockService';
import type { AnesthesiaSyncState, RecordPersistMeta, SyncConflictResolveAction } from '@/types/anesthesiaLocalDb';
import type { LatestDeviceDataApi, LatestDeviceRawApi } from '@/api/anesthesiaSync';
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
import { runAuthenticatedBootstrap } from '@/services/bootstrap/authenticatedBootstrap';
import { isSamisLoggedIn } from '@/services/session/samisSession';
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
    followUpSource: 'mock' as 'remote' | 'mock',
    complicationSource: 'mock' as 'remote' | 'mock',
    preopSource: 'mock' as 'remote' | 'mock',
    analgesiaCases: [] as Array<import('@/services/anesthesia/postoperativeService').PostCaseSummary>,
    analgesiaCasesSource: 'mock' as 'remote' | 'mock',
    unplannedCases: [] as Array<import('@/services/anesthesia/postoperativeService').PostCaseSummary>,
    unplannedCasesSource: 'mock' as 'remote' | 'mock',
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
    workbenchSummary: null as (WorkbenchSummary & { source?: string }) | null,
    workbenchRoomStatus: [] as WorkbenchRoomStatus[],
    roomCatalogSource: '' as string,
    drugDictSource: '' as string,
    configTemplateItems: [] as PrintTemplateItem[],
    configStaffItems: [] as StaffDictItem[],
    configDictSource: '' as string,
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
    simulatedRealtimeDeviceData: {} as Record<string, LatestDeviceDataApi>,
    monitoringSessionRevision: 0,
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
    pacuSource: 'mock' as 'remote' | 'mock',
    pacuBookingsSource: 'mock' as 'remote' | 'mock',
    remoteBedStats: null as PacuBedStatsApi | null,
    pacuBedsSource: 'mock' as 'remote' | 'mock',
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
    remoteQualityChecks: [] as QualityCheckApi[],
    remoteQualityChecksSource: 'mock' as 'remote' | 'mock',
    remoteHypothermiaCases: { total: 0, list: [] } as QualityHypothermiaResultApi,
    remoteAdverseEvents: { total: 0, list: [] } as QualityAdverseEventResultApi,
    aggregatorSource: 'mock' as 'remote' | 'mock',
    remoteIndicators: [] as QualityIndicatorApi[],
    remoteIndicatorsSource: 'mock' as 'remote' | 'mock',
    remoteIndicatorDetail: null as QualityIndicatorDetailApi | null,
    remoteAdminUsers: [] as SystemUser[],
    remoteAdminUsersSource: 'mock' as 'remote' | 'mock',
    remoteAdminUserGroups: [] as AdminUserGroupApi[],
    remoteAdminUserGroupsSource: 'mock' as 'remote' | 'mock',
    remoteMenuTree: [] as AdminMenuNodeApi[],
    remoteMenuTreeSource: 'mock' as 'remote' | 'mock',
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
      // T28：真实模式且后端指标为权威来源时，用后端权威值覆盖列表展示项的数值/状态
      // （列表无需趋势/维度分析，保留本地 trend/yoy/mom 演示与标签即可）。
      const merged = useRealQuality() && state.remoteIndicatorsSource === 'remote' && state.remoteIndicators.length
        ? (() => {
            const byCode = new Map(state.remoteIndicators.map((item) => [item.code, item]));
            return details.map((item) => {
              const remote = byCode.get(item.code);
              if (!remote) return item;
              return {
                ...item,
                currentValue: typeof remote.value === 'number' ? remote.value : Number(remote.value),
                numerator: remote.numerator,
                denominator: remote.denominator,
                displayValue: remote.displayValue,
                expression: remote.expression,
                status: remote.status,
              };
            });
          })()
        : details;
      return state.qualityFilter.category === '全部' ? merged : merged.filter((item) => item.category === state.qualityFilter.category);
    },
    selectedIndicator(state) {
      void state.datasetVersion;
      const base = calculateIndicatorDetails(getMutableDataset(), state.qualityFilter)
        .map((item) => ({ ...item, favorite: state.favoriteIndicatorCodes.includes(item.code) }))
        .find((item) => item.code === state.selectedIndicatorCode);
      // T28：真实模式且已加载该指标后端穿透详情 → 混合合并（后端权威值+穿透cases+维度再派生；
      // 趋势/yoy/mom 维持本地演示；nullAnalysis 置空）。否则维持 TS 计算。
      if (base && useRealQuality() && state.remoteIndicatorDetail && state.remoteIndicatorDetail.code === base.code) {
        return mergeRemoteIndicatorDetail(base, state.remoteIndicatorDetail);
      }
      return base;
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
        .forEach((item) => {
          const plannedStart = dayjs(item.plannedStart);
          items.push({
            id: `todo-pre-${item.id}`,
            title: `${item.patientName} 术前访视未完成`,
            category: '访视',
            caseId: item.id,
            priority: '高',
            dueTime: plannedStart.isValid() ? plannedStart.subtract(1, 'day').toISOString() : undefined,
            status: '待处理',
          });
        });
      this.qualityDefects
        .filter((item) => item.status === '待整改' || item.status === '待确认')
        .forEach((item) => items.push({ id: `todo-def-${item.defectId}`, title: item.defectType, category: '缺陷', caseId: item.caseId, priority: item.defectLevel === '严重' ? '高' : '中', status: '待处理' }));
      state.pacuPatients
        .filter((item) => item.status !== '已转出' && dayjs().diff(dayjs(item.inTime), 'minute') > 120)
        .forEach((item) => {
          const inTime = dayjs(item.inTime);
          items.push({
            id: `todo-pacu-${item.id}`,
            title: `${item.patientName} PACU 转出延迟`,
            category: 'PACU',
            caseId: item.caseId,
            priority: '高',
            dueTime: inTime.isValid() ? inTime.add(120, 'minute').toISOString() : undefined,
            status: '待处理',
          });
        });
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
      // 真实模式优先使用后端 bedStats（含 reserved/maintenance 分类桶）
      if (useRealPacu() && state.remoteBedStats) {
        const s = state.remoteBedStats;
        const total = s.total;
        const used = s.used;
        const free = s.free;
        return {
          total,
          used,
          free,
          reserved: s.reserved,
          maintenance: s.maintenance,
          occupancy: total ? Math.round((used / total) * 100) : 0,
        };
      }
      const beds = state.pacuRooms.flatMap((r) => r.beds);
      const total = beds.length;
      const used = beds.filter((b) => b.status === '占用').length;
      const free = beds.filter((b) => b.status === '空闲').length;
      const reserved = beds.filter((b) => b.status === '预留').length;
      const maintenance = beds.filter((b) => b.status === '维护').length;
      return { total, used, free, reserved, maintenance, occupancy: total ? Math.round((used / total) * 100) : 0 };
    },
    auditLogs: () => getAuditLogs(),
    integrationEndpoints: () => getIntegrationEndpoints(),
    systemUsers(state): SystemUser[] {
      if (useRealAdmin() && state.remoteAdminUsersSource === 'remote') {
        return state.remoteAdminUsers;
      }
      return getSystemUsers();
    },
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
          this.cases = dedupeCasesByOperationId(await hydrateAnesthesiaCasesFromLocalDb([], { appendOrphans: true }));
        } else {
          this.cases = dedupeCasesByOperationId(await hydrateAnesthesiaCasesFromLocalDb(clone(buildInitialClinicalState().cases)));
        }
        this.localDbReady = true;
        this.localPersistenceReady = true;
        await this.ensureClinicalSeedData();
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
    async bootstrapSamisAuthenticatedData() {
      await runAuthenticatedBootstrap({
        isLoggedIn: () => isSamisLoggedIn(),
        load: async () => {
          await this.loadSamisBaseCatalog();
          startAnesthesiaSyncService();
        },
      });
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
      this.cases = dedupeCasesByOperationId(result.cases);
      this.operationListSource = result.source;
      if (result.cases.length) {
        result.cases.forEach((item) => syncCaseToDataset(getMutableDataset(), item));
        bumpDatasetVersion();
        this.datasetVersion += 1;
      }
      await this.ensureClinicalSeedData();
      return result;
    },
    async loadTodayWorkbench() {
      const result = await fetchTodayWorkbench();
      this.cases = dedupeCasesByOperationId(result.cases);
      this.operationListSource = result.source;
      this.workbenchSummary = { ...result.summary, source: result.source };
      this.workbenchRoomStatus = result.roomStatus;
      if (result.cases.length) {
        result.cases.forEach((item) => syncCaseToDataset(getMutableDataset(), item));
        bumpDatasetVersion();
        this.datasetVersion += 1;
      }
      await this.ensureClinicalSeedData();
      return result;
    },
    async loadRoomCatalog() {
      try {
        const catalog = await loadRoomCatalog();
        this.configRooms = catalog.roomNames;
        this.roomGroups = catalog.groups;
        this.roomCatalogSource = catalog.source;
        return catalog;
      } catch (error) {
        // 真实模式失败时保持现有派生状态，不回填默认手术间，不向调用方抛出以免阻断排程等页面。
        console.warn('[samis] loadRoomCatalog failed; keeping existing room state', error);
        return {
          roomNames: this.configRooms,
          rooms: [],
          groups: this.roomGroups,
          source: 'remote' as const,
        };
      }
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
    async loadRemoteFluidDict() {
      const result = await loadFluidDictCatalog();
      this.configDictSource = result.source;
      this.configFluids = result.items;
      return result;
    },
    async loadRemoteTemplateDict() {
      const result = await loadTemplateCatalog();
      this.configDictSource = result.source;
      this.configTemplateItems = result.items;
      if (result.names.length) this.configPrintTemplates = result.names;
      return result;
    },
    async loadRemoteVitalDict() {
      const result = await loadVitalDictCatalog();
      this.configDictSource = result.source;
      this.configVitals = result.items;
      return result;
    },
    async loadRemoteStaffDict() {
      const result = await loadStaffCatalog();
      this.configDictSource = result.source;
      this.configStaffItems = result.items;
      // 真实空列表直接覆盖，不再保留 seed；错误已由 loadStaffCatalog 吞掉并返回空
      this.configStaff = result.names;
      return result;
    },
    async loadRemoteDictList(listKey: 'configEvents' | 'configScores', categoryCode: string) {
      const result = await loadDictListByCategory(categoryCode);
      this.configDictSource = result.source;
      // 真实空列表直接覆盖，不再保留 seed；错误已由 loadDictListByCategory 吞掉并返回空
      this[listKey] = result.names;
      return result;
    },
    async loadRemoteMethodTree() {
      const result = await loadMethodTree();
      this.configDictSource = result.source;
      this.configMethods = result.tree;
      return result;
    },
    async loadRemoteRoomDict() {
      const result = await loadRoomNameCatalog();
      this.configDictSource = result.source;
      if (result.names.length) this.configRooms = result.names;
      return result;
    },
    /** 加载 PACU 恢复单列表，回填 pacuPatients（真实开关开→远程；关→mock 兜底）。 */
    async loadRemotePacuList(params?: { status?: string; room?: string; caseId?: string }) {
      const result = await loadRemotePacuList(params);
      this.pacuSource = result.source;
      if (useRealPacu() && result.source === 'remote') {
        this.pacuPatients = result.list;
      } else if (result.list.length) {
        this.pacuPatients = result.list;
      }
      syncAllClinicalToDataset(getMutableDataset(), this.cases, this.pacuPatients, this.followUps);
      bumpDatasetVersion();
      this.datasetVersion += 1;
      return result;
    },
    /** 入 PACU（真实开关开→调 api 并刷新列表；关→返回 null 由调用方本地处理）。 */
    async admitPacu(input: {
      caseId: string;
      patientName: string;
      room?: string;
      operationId?: string;
      firstTemperature?: number;
      hr?: number;
      bp?: string;
      spo2?: number;
      rr?: number;
      aldrete?: number;
      vas?: number;
      bedNo?: string;
      remark?: string;
    }) {
      const created = await admitPacuPatient(input);
      if (useRealPacu()) {
        await this.loadRemotePacuList();
        // 入室联动预约状态：后端 admit 已 markBookingReceived，前端重拉预约同步。
        await this.loadRemotePacuBookings();
        // admit 带 bedId 时床位状态服务端翻转，刷新床位看板。
        await this.loadRemotePacuBeds();
      }
      return created;
    },
    /** 更新恢复记录字段（真实开关开→调 api）。 */
    async updatePacuRecord(id: string | number, patch: Partial<PacuPatient>) {
      await updatePacuRecordRemote(id, patch);
      const index = this.pacuPatients.findIndex((item) => String(item.id) === String(id));
      if (index >= 0) {
        this.pacuPatients[index] = { ...this.pacuPatients[index], ...patch };
        syncAllClinicalToDataset(getMutableDataset(), this.cases, this.pacuPatients, this.followUps);
        bumpDatasetVersion();
        this.datasetVersion += 1;
      }
    },
    /** 转出（真实开关开→调 api 并刷新列表）。 */
    async transferOutPacu(input: {
      id: string | number;
      outDestination: PacuPatient['transferTo'];
      pacuOutTime?: string;
      aldreteOut?: number;
      handoverNurseId?: string;
    }) {
      await transferOutPacuPatient(input);
      if (useRealPacu()) {
        await this.loadRemotePacuList();
        // transferOut 联动床位释放，刷新床位看板。
        await this.loadRemotePacuBeds();
      } else {
        const index = this.pacuPatients.findIndex((item) => String(item.id) === String(input.id));
        if (index >= 0) {
          this.pacuPatients[index] = {
            ...this.pacuPatients[index],
            status: '已转出',
            outTime: input.pacuOutTime ?? dayjs().toISOString(),
            transferTo: input.outDestination,
            handover: input.handoverNurseId ?? this.pacuPatients[index].handover,
          };
          syncAllClinicalToDataset(getMutableDataset(), this.cases, this.pacuPatients, this.followUps);
          bumpDatasetVersion();
          this.datasetVersion += 1;
        }
      }
    },
    /** 加载 PACU 预约列表，回填 pacuBookings（真实开关开→远程；关→mock 兜底）。 */
    async loadRemotePacuBookings(params?: { status?: string; pacuRoomId?: string; caseId?: string }) {
      const result = await loadRemotePacuBookings(params);
      this.pacuBookingsSource = result.source;
      if (useRealPacu() && result.source === 'remote') {
        this.pacuBookings = result.list;
      } else if (result.list.length) {
        this.pacuBookings = result.list;
      }
      return result;
    },
    /** 创建预约（真实开关开→调 api 成功后 upsert 本地；关→本地 upsert）。 */
    async createPacuBooking(booking: PacuBooking) {
      const created = await createPacuBookingRemote(booking);
      const finalBooking: PacuBooking = created ?? booking;
      this.savePacuBooking(finalBooking);
      return finalBooking;
    },
    /** 更新预约（真实开关开→调 api 成功后 upsert 本地；关→本地 upsert）。 */
    async updatePacuBooking(id: string | number, patch: Partial<PacuBooking>) {
      await updatePacuBookingRemote(id, patch);
      const index = this.pacuBookings.findIndex((item) => String(item.id) === String(id));
      if (index >= 0) {
        this.pacuBookings[index] = { ...this.pacuBookings[index], ...patch };
      }
    },
    /** 取消预约（真实开关开→调 api；关→本地改状态）。 */
    async cancelPacuBooking(id: string | number) {
      await cancelPacuBookingRemote(id);
      const index = this.pacuBookings.findIndex((item) => String(item.id) === String(id));
      if (index >= 0) {
        this.pacuBookings[index] = { ...this.pacuBookings[index], status: '已取消' };
      }
    },
    /** 加载 PACU 床位（按 room 分组），回填 pacuRooms + remoteBedStats（真实开关开→远程）。 */
    async loadRemotePacuBeds() {
      const result = await loadRemotePacuBeds();
      this.pacuBedsSource = result.source;
      if (useRealPacu()) {
        // 真实模式：床位为权威状态来源，远程数据覆盖 mock 派生。
        if (result.rooms.length || result.source === 'remote') {
          this.pacuRooms = result.rooms;
        }
        this.remoteBedStats = result.stats;
      } else if (result.rooms.length) {
        this.pacuRooms = result.rooms;
        this.remoteBedStats = result.stats;
      }
      return result;
    },
    /** 加载低体温病例聚合（真实开关开→远程；关→保持空，视图回退 mock 派生）。 */
    async loadRemoteHypothermiaCases() {
      if (!useRealQuality()) {
        this.remoteHypothermiaCases = { total: 0, list: [] };
        this.aggregatorSource = 'mock';
        return this.remoteHypothermiaCases;
      }
      const { result, source } = await loadHypothermiaCases(this.qualityFilter);
      this.remoteHypothermiaCases = result;
      this.aggregatorSource = source;
      return result;
    },
    /** 加载不良事件聚合（真实开关开→远程；关→保持空，视图回退 mock 派生）。 */
    async loadRemoteAdverseEvents() {
      if (!useRealQuality()) {
        this.remoteAdverseEvents = { total: 0, list: [] };
        this.aggregatorSource = 'mock';
        return this.remoteAdverseEvents;
      }
      const { result, source } = await loadAdverseEvents(this.qualityFilter);
      this.remoteAdverseEvents = result;
      this.aggregatorSource = source;
      return result;
    },
    /** 加载 26 指标列表（真实开关开→远程权威值；关→保持空，视图回退本地 TS 计算）。 */
    async loadRemoteIndicators() {
      if (!useRealQuality()) {
        this.remoteIndicators = [];
        this.remoteIndicatorsSource = 'mock';
        return this.remoteIndicators;
      }
      const { result, source } = await loadIndicators(this.qualityFilter);
      this.remoteIndicators = result;
      this.remoteIndicatorsSource = source;
      return result;
    },
    /** 加载单指标穿透详情（真实开关开→远程权威值+穿透cases；关→保持 null）。 */
    async loadRemoteIndicatorDetail(code: string) {
      if (!useRealQuality()) {
        this.remoteIndicatorDetail = null;
        return this.remoteIndicatorDetail;
      }
      // 先清空：避免切换指标的网络往返期内 selectedIndicator getter 用旧指标详情合并。
      this.remoteIndicatorDetail = null;
      const { result, source } = await loadIndicatorDetail(code, this.qualityFilter);
      this.remoteIndicatorDetail = source === 'remote' ? result : null;
      return this.remoteIndicatorDetail;
    },
    /** 加载质控抽查记录（真实开关开→远程；关→mock 路由兜底）。 */
    async loadRemoteQualityChecks() {
      const { list, total, source } = await loadQualityChecks();
      this.remoteQualityChecks = list;
      this.remoteQualityChecksSource = source;
      // mock 模式下若远程返回空，则保留本地 mock 种子 qualityChecks 不被覆盖；
      // 真实模式下若远程为权威，则同步落到 qualityChecks 供现有视图消费。
      if (useRealQuality() && source === 'remote') {
        this.qualityChecks = list.map((item) => ({
          id: String(item.id),
          checkItem: item.checkItem,
          standard: item.standard ?? '',
          result: item.result,
          checker: item.checker ?? '',
          checkDate: item.checkDate ?? '',
          issueDesc: item.issueDesc ?? undefined,
          rectifyStatus: item.rectifyStatus,
        })) as QualityCheckRecord[];
      }
      return { list, total };
    },
    /** 创建抽查记录（真实开关开→调 api 返回新行；关→本地构建）。 */
    async createQualityCheck(input: QualityCheckInput) {
      const created = await createQualityCheckRemote(input);
      if (created) {
        await this.loadRemoteQualityChecks();
        return created;
      }
      // mock 模式本地构建
      const record: QualityCheckRecord = {
        id: `qc-${Date.now()}`,
        checkItem: input.checkItem,
        standard: input.standard ?? '',
        result: input.result ?? '待查',
        checker: input.checker ?? '',
        checkDate: input.checkDate ?? dayjs().format('YYYY-MM-DD'),
        issueDesc: input.issueDesc,
        rectifyStatus: input.rectifyStatus ?? '待整改',
      };
      this.qualityChecks = [record, ...this.qualityChecks];
      return record;
    },
    /** 更新抽查记录（真实开关开→调 api；关→本地更新）。 */
    async updateQualityCheck(id: string | number, patch: QualityCheckPatch) {
      await updateQualityCheckRemote(id, patch);
      if (useRealQuality()) {
        await this.loadRemoteQualityChecks();
        return;
      }
      const index = this.qualityChecks.findIndex((item) => String(item.id) === String(id));
      if (index >= 0) {
        this.qualityChecks[index] = { ...this.qualityChecks[index], ...patch } as QualityCheckRecord;
      }
    },
    /** 删除抽查记录（真实开关开→调 api；关→本地删除）。 */
    async deleteQualityCheck(id: string | number) {
      await deleteQualityCheckRemote(id);
      if (useRealQuality()) {
        await this.loadRemoteQualityChecks();
        return;
      }
      this.qualityChecks = this.qualityChecks.filter((item) => String(item.id) !== String(id));
    },
    async bootstrapRemoteConfigs() {
      const results = await Promise.allSettled([
        this.loadRemoteDrugDict({ enabled: true }),
        this.loadRemoteFluidDict(),
        this.loadRemoteTemplateDict(),
        this.loadRemoteVitalDict(),
        this.loadRemoteStaffDict(),
        this.loadRemoteMethodTree(),
        this.loadRemoteDictList('configEvents', 'anesthesia_event'),
        this.loadRemoteDictList('configScores', 'anesthesia_score'),
        this.loadRemoteRoomDict(),
        this.loadRemotePacuList(),
        this.loadRemotePacuBookings(),
        this.loadRemotePacuBeds(),
      ]);
      results.forEach((entry, index) => {
        if (entry.status === 'rejected') {
          console.warn('[samis] bootstrapRemoteConfigs task failed', index, entry.reason);
        }
      });
      await this.ensureClinicalSeedData();
    },
    async loadSamisBaseCatalog() {
      const results = await Promise.allSettled([
        this.loadRoomCatalog(),
        this.loadRemoteOperationList({ operationDate: dayjs().format('YYYY-MM-DD') }),
        this.bootstrapRemoteConfigs(),
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
    async loadOperationCaseById(caseId: string) {
      if (!caseId) return null;
      const existing = this.cases.find((item) => item.id === caseId);
      if (existing) return existing;
      const fetched = await fetchOperationCaseById(caseId);
      if (!fetched) return null;
      this.upsertCase(fetched);
      return this.hydrateCaseFromOperationInfo(caseId);
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
      // 监护注册表保存在模块级运行态中。暂停和停止时同步摘要都可能是
      // monitorRunning=false/ventilatorRunning=false，因此需要独立版本号
      // 通知视图重新读取注册表，避免“已停止但按钮仍显示”的陈旧状态。
      this.monitoringSessionRevision += 1;
      const ui = resolveMonitoringViewUi(viewCaseId, getMonitoringRegistry());
      const viewCase = this.cases.find((item) => item.id === viewCaseId);
      const ownerId = getActiveMockSession()?.recordLocalId ?? viewCaseId;
      const ownerCase = this.cases.find((item) => item.id === ownerId);
      patchAnesthesiaSyncUiState({
        monitorRunning: ui.monitorRunning,
        ventilatorRunning: ui.ventilatorRunning,
        lastCollectTime: getMonitoringSession(viewCaseId)?.lastCollectTime
          ?? ownerCase?.device?.lastCollectTime
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
        onRaw: (id: string, deviceType: 'monitor' | 'ventilator', raw: LatestDeviceRawApi) => {
          const current = this.simulatedRealtimeDeviceData[id] ?? { monitor: null, ventilator: null };
          this.simulatedRealtimeDeviceData[id] = { ...current, [deviceType]: raw };
        },
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
    pauseAllMonitoringDevices() {
      const scopeId = this.activeRecordScopeId;
      if (!scopeId) return { ok: false as const, message: '无监护会话' };
      const session = getMonitoringSession(scopeId);
      if (!session || (!session.monitorActive && !session.ventilatorActive)) {
        return { ok: false as const, message: '无活动监护会话' };
      }
      this.pauseMonitoringMockTimers();
      const target = this.cases.find((item) => item.id === scopeId);
      if (target?.device) {
        target.device.collectStatus = '采集暂停';
        if (session.monitorActive) target.device.monitor = '模拟已暂停';
        if (session.ventilatorActive) target.device.anesthesiaMachine = '模拟已暂停';
        void patchRecordDeviceCollectMeta(scopeId, {
          collectStatus: '采集暂停',
          ...(session.monitorActive ? { monitor: '模拟已暂停' } : {}),
          ...(session.ventilatorActive ? { anesthesiaMachine: '模拟已暂停' } : {}),
        });
      }
      this.applyMonitoringUiForScope(scopeId);
      return { ok: true as const };
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
      if (!target) return { ok: false as const, message: '麻醉记录单不存在。' };
      if (target.locked) return { ok: false as const, message: '麻醉记录已锁定，无法启动记录。' };
      if (target.recordStatus && target.recordStatus !== '未开始') {
        return { ok: false as const, message: '当前记录已经启动或结束，请勿重复操作。' };
      }
      const now = resolveRecordSheetNowIso(target);
      const session = getMonitoringSession(caseId);
      const deviceSessionActive = Boolean(
        session
        && session.status !== 'stopped'
        && session.status !== 'revoked'
        && (session.monitorActive || session.ventilatorActive),
      );
      target.recordStatus = '采集中';
      target.collectStatus = deviceSessionActive ? '采集中' : '未连接';
      target.actualStart = target.actualStart ?? now;
      target.device = {
        ...(target.device ?? {}),
        monitor: deviceSessionActive && session?.monitorActive ? '采集中' : '待启动',
        anesthesiaMachine: deviceSessionActive && session?.ventilatorActive ? '采集中' : '待启动',
        infusionPump: target.device?.infusionPump ?? '未连接',
        collectStatus: deviceSessionActive ? '采集中' : '待启动',
        dataSource: target.device?.dataSource ?? '设备尚未启动',
        collectFrequency: target.vitalFrequency ?? '5分钟',
        receiveStatus: target.device?.receiveStatus ?? '等待设备连接',
        logs: target.device?.logs ?? [],
      };
      target.operationLogs = ['启动麻醉记录', ...(target.operationLogs ?? [])].slice(0, 8);
      const draft = (this.recordDrafts[caseId] && typeof this.recordDrafts[caseId] === 'object')
        ? this.recordDrafts[caseId] as Record<string, unknown>
        : {};
      if (!Array.isArray(draft.monitorOrder) || !(draft.monitorOrder as string[]).length) {
        this.saveMonitorOrderDraft(caseId, resolveDefaultMonitorOrder(this.configVitals));
      }
      this.syncRecordDocument(caseId);
      this.afterRecordMutation(caseId, {
        entityType: 'record',
        entityLocalId: caseId,
        operationType: 'update',
        apiPath: ANESTHESIA_SYNC_QUEUE_API_PATH,
      });
      return { ok: true as const, startedAt: now };
    },
    async endAnesthesiaRecord(caseId: string, endAt?: string) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target) return { ok: false as const, message: '麻醉记录单不存在。' };
      const session = getMonitoringSession(caseId);
      const deviceSessionActive = Boolean(
        session
        && session.status !== 'stopped'
        && session.status !== 'revoked'
        && (session.monitorActive || session.ventilatorActive),
      );
      const resolvedEndAt = endAt ?? resolveRecordSheetNowIso(target);
      const validation = validateRecordEnd(target, resolvedEndAt, {
        deviceSessionActive,
        rescueActive: isRescueModeActive(target),
      });
      if (!validation.ok) return validation;

      target.recordEndTime = resolvedEndAt;
      this.syncRecordDocument(caseId);
      // 先把所有临床数据以 recording 草稿状态真实同步，随后由 submitRecord 原子冻结版本。
      await persistCaseNow(target, this.recordPageDrafts[caseId] ?? 1, {
        entityType: 'record',
        entityLocalId: caseId,
        operationType: 'update',
        apiPath: ANESTHESIA_SYNC_QUEUE_API_PATH,
      });
      const pendingSignatures = {
        ...(target.signatures ?? {}),
        status: '待签名' as const,
      };
      const submittedCase = {
        ...target,
        recordStatus: '待签名' as const,
        signatures: pendingSignatures,
      };
      const submitted = await submitRecordForSignature(caseId, { casePayload: submittedCase });
      if (!submitted.ok) return submitted;

      target.recordStatus = '待签名';
      target.collectStatus = '已结束';
      if (target.device) target.device.collectStatus = '已结束';
      target.signatures = {
        ...pendingSignatures,
        revisionId: submitted.revisionId,
        documentVersion: submitted.documentVersion,
        serverSyncVersion: submitted.syncVersion,
        submittedAt: submitted.submittedAt ?? undefined,
      };
      target.operationLogs = [`结束麻醉记录（${dayjs(resolvedEndAt).format('YYYY-MM-DD HH:mm')}），已冻结版本，待签名`, ...(target.operationLogs ?? [])].slice(0, 8);
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
      return { ok: true as const, endAt: resolvedEndAt, revisionId: submitted.revisionId };
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
    /** 加载术后随访（真实开关开→远程；关→mock 兜底）。 */
    async loadRemoteFollowups(params?: { caseId?: string; followupType?: string }) {
      const result = await loadRemoteFollowups(params);
      this.followUpSource = result.source;
      if (result.source === 'remote' || result.list.length) {
        this.followUps = result.list;
        bumpDatasetVersion();
        this.datasetVersion += 1;
      }
      return result;
    },
    /** 新增/更新随访（真实开关开→调 api；关→本地 upsert）。 */
    async upsertFollowupRemote(payload: PostoperativeFollowUp) {
      const created = await upsertFollowupRemote(payload);
      const finalPayload: PostoperativeFollowUp = created ?? payload;
      if (created && /^\d+$/.test(created.id) && !/^\d+$/.test(payload.id)) {
        // 新建成功后用服务端 id 替换本地临时 id
        finalPayload.id = created.id;
      }
      this.upsertFollowUp(finalPayload);
      return finalPayload;
    },
    /** 删除随访（真实开关开→调 api；关→本地移除）。 */
    async deleteFollowupRemote(id: string) {
      await deleteFollowupRemote(id);
      this.followUps = this.followUps.filter((item) => item.id !== id);
      bumpDatasetVersion();
      this.datasetVersion += 1;
    },
    /** 加载并发症列表（真实开关开→远程；关→mock 兜底）。 */
    async loadRemoteComplications(params?: { caseId?: string; status?: string; complicationType?: string }) {
      const result = await loadRemoteComplications(params);
      this.complicationSource = result.source;
      if (result.source === 'remote' || result.list.length) {
        this.complications = result.list;
      }
      return result;
    },
    /** 新增/更新并发症（真实开关开→调 api；关→本地）。 */
    async upsertComplicationRemote(record: ComplicationRecord) {
      const created = await upsertComplicationRemote(record);
      const finalRecord: ComplicationRecord = created ?? record;
      if (created && /^\d+$/.test(created.id) && !/^\d+$/.test(record.id)) {
        finalRecord.id = created.id;
      }
      this.saveComplication(finalRecord);
      return finalRecord;
    },
    /** 删除并发症（真实开关开→调 api；关→本地移除）。 */
    async deleteComplicationRemote(id: string) {
      await deleteComplicationRemote(id);
      this.complications = this.complications.filter((item) => item.id !== id);
    },
    /** 加载镇痛病例聚合（真实开关开→远程；关→返回空由前端派生 store.cases）。 */
    async loadRemoteAnalgesiaCases(params?: { room?: string }) {
      const result = await loadRemoteAnalgesiaCases(params);
      this.analgesiaCasesSource = result.source;
      if (result.source === 'remote') {
        this.analgesiaCases = result.list;
      }
      return result;
    },
    /** 加载非计划事件病例聚合（真实开关开→远程；关→返回空由前端派生 store.cases）。 */
    async loadRemoteUnplannedCases(params?: { room?: string }) {
      const result = await loadRemoteUnplannedCases(params);
      this.unplannedCasesSource = result.source;
      if (result.source === 'remote') {
        this.unplannedCases = result.list;
      }
      return result;
    },
    /**
     * =====================================================================
     * Slice 7 术前管理：申请接收 / 会诊 / 检查 / 知情同意 / 安全核查
     * =====================================================================
     */
    /** 加载手术申请列表（真实开关开→远程；关→mock 兜底）。 */
    async loadRemotePreopRequests(params?: { status?: string; urgency?: string; department?: string }) {
      const result = await loadRemoteRequests(params);
      this.preopSource = result.source;
      if (useRealPreoperative() && result.source === 'remote') {
        this.surgeryRequests = result.list;
      } else if (result.list.length) {
        this.surgeryRequests = result.list;
      }
      return result;
    },
    /** 接收申请（真实开关开→调 api 后重拉；关→本地置 已排班）。 */
    async receivePreopRequest(id: string) {
      await receiveRequestRemote(id);
      if (useRealPreoperative()) {
        await this.loadRemotePreopRequests();
        return;
      }
      const index = this.surgeryRequests.findIndex((item) => item.id === id);
      if (index >= 0) this.surgeryRequests[index] = { ...this.surgeryRequests[index], status: '已排班' };
    },
    /** 取消申请（真实开关开→调 api 后重拉；关→本地置 已取消）。 */
    async cancelPreopRequest(id: string) {
      await cancelRequestRemote(id);
      if (useRealPreoperative()) {
        await this.loadRemotePreopRequests();
        return;
      }
      const index = this.surgeryRequests.findIndex((item) => item.id === id);
      if (index >= 0) this.surgeryRequests[index] = { ...this.surgeryRequests[index], status: '已取消' };
    },
    /** 加载会诊列表（真实开关开→远程；关→mock 兜底）。 */
    async loadRemotePreopConsultations(params?: { caseId?: string; status?: string }) {
      const result = await loadRemoteConsultations(params);
      this.preopSource = result.source;
      if (useRealPreoperative() && result.source === 'remote') {
        this.consultations = result.list;
      } else if (result.list.length) {
        this.consultations = result.list;
      }
      return result;
    },
    /** 新增/更新会诊（真实开关开→调 api；关→本地 upsert）。 */
    async upsertPreopConsultation(record: ConsultationRecord) {
      const created = await upsertConsultationRemote(record);
      const finalRecord: ConsultationRecord = created ?? record;
      if (created && /^\d+$/.test(created.id) && !/^\d+$/.test(record.id)) {
        finalRecord.id = created.id;
      }
      const index = this.consultations.findIndex((item) => item.id === finalRecord.id);
      if (index >= 0) this.consultations[index] = finalRecord;
      else this.consultations.unshift(finalRecord);
      return finalRecord;
    },
    async submitPreopConsultation(id: string) {
      const remote = await submitConsultationRemote(id);
      const index = this.consultations.findIndex((item) => item.id === id);
      if (remote && index >= 0) this.consultations[index] = remote;
      else if (index >= 0) this.consultations[index] = { ...this.consultations[index], status: '已完成' };
      return remote ?? this.consultations[index] ?? null;
    },
    async cancelPreopConsultation(id: string, reason = '') {
      const remote = await cancelConsultationRemote(id, reason);
      const index = this.consultations.findIndex((item) => item.id === id);
      if (remote && index >= 0) this.consultations[index] = remote;
      else if (index >= 0) this.consultations[index] = { ...this.consultations[index], status: '已取消', cancelReason: reason };
      return remote ?? this.consultations[index] ?? null;
    },
    /** 加载检查审核列表（真实开关开→远程；关→mock 兜底）。 */
    async loadRemotePreopExamReviews(params?: { caseId?: string; reviewResult?: string }) {
      const result = await loadRemoteExamReviews(params);
      this.preopSource = result.source;
      if (useRealPreoperative() && result.source === 'remote') {
        this.examReviews = result.list;
      } else if (result.list.length) {
        this.examReviews = result.list;
      }
      return result;
    },
    /** 新增/更新检查审核（真实开关开→调 api；关→本地 upsert）。 */
    async upsertPreopExamReview(record: ExamReviewRecord) {
      const created = await upsertExamReviewRemote(record);
      const finalRecord: ExamReviewRecord = created ?? record;
      if (created && /^\d+$/.test(created.id) && !/^\d+$/.test(record.id)) {
        finalRecord.id = created.id;
      }
      const index = this.examReviews.findIndex((item) => item.id === finalRecord.id);
      if (index >= 0) this.examReviews[index] = finalRecord;
      else this.examReviews.unshift(finalRecord);
      return finalRecord;
    },
    /** 加载知情同意列表（真实开关开→远程；关→mock 兜底）。 */
    async loadRemotePreopConsentRecords(params?: { caseId?: string; status?: string }) {
      const result = await loadRemoteConsentRecords(params);
      this.preopSource = result.source;
      if (useRealPreoperative() && result.source === 'remote') {
        this.consentRecords = result.list;
      } else if (result.list.length) {
        this.consentRecords = result.list;
      }
      return result;
    },
    /** 按 caseId 取唯一活跃同意书（1:1 首选读；无则 null）。真实开关关→走本地 store 派生。 */
    async fetchPreopConsentByCaseId(caseId: string): Promise<ConsentRecord | null> {
      const remote = await fetchConsentByCaseId(caseId);
      if (remote) {
        // 远程读到的记录同步落 store，供页面 computed 消费。
        this.saveConsentRecord(remote);
        return remote;
      }
      return this.consentRecords.find((item) => item.caseId === caseId) ?? null;
    },
    /** 新增/更新知情同意（真实开关开→调 api；关→本地 saveConsentRecord）。 */
    async upsertPreopConsent(record: ConsentRecord) {
      const created = await upsertConsentRemote(record);
      const finalRecord: ConsentRecord = created ?? { ...record, updatedAt: dayjs().toISOString() };
      if (created && /^\d+$/.test(created.id) && !/^\d+$/.test(record.id)) {
        finalRecord.id = created.id;
      }
      this.saveConsentRecord(finalRecord);
      return finalRecord;
    },
    /** 提交知情同意（真实开关开→调 api 返回最新行；关→本地置已提交）。 */
    async submitPreopConsent(id: string): Promise<ConsentRecord | null> {
      const submitted = await submitConsentRemote(id);
      if (submitted) {
        this.saveConsentRecord(submitted);
        return submitted;
      }
      const index = this.consentRecords.findIndex((item) => item.id === id);
      if (index >= 0) {
        const now = dayjs().toISOString();
        this.consentRecords[index] = {
          ...this.consentRecords[index],
          status: '已提交',
          signedAt: this.consentRecords[index].signedAt ?? now,
          updatedAt: now,
        };
        return this.consentRecords[index];
      }
      return null;
    },
    async withdrawPreopConsent(id: string): Promise<ConsentRecord | null> {
      const remote = await withdrawConsentRemote(id);
      const index = this.consentRecords.findIndex((item) => item.id === id);
      if (remote && index >= 0) this.consentRecords[index] = remote;
      else if (index >= 0) this.consentRecords[index] = { ...this.consentRecords[index], status: '草稿' };
      return remote ?? this.consentRecords[index] ?? null;
    },
    async markPreopConsentPrinted(id: string): Promise<ConsentRecord | null> {
      const remote = await markConsentPrintedRemote(id);
      const index = this.consentRecords.findIndex((item) => item.id === id);
      if (remote && index >= 0) this.consentRecords[index] = remote;
      else if (index >= 0) this.consentRecords[index] = { ...this.consentRecords[index], printStatus: '已打印' };
      return remote ?? this.consentRecords[index] ?? null;
    },
    /** 加载安全核查列表（真实开关开→远程；关→mock 兜底）。 */
    async loadRemotePreopSafetyChecks(params?: { caseId?: string; status?: string }) {
      const result = await loadRemoteSafetyChecks(params);
      this.preopSource = result.source;
      if (useRealPreoperative() && result.source === 'remote') {
        this.safetyChecks = result.list;
      } else if (result.list.length) {
        this.safetyChecks = result.list;
      }
      return result;
    },
    /** 按 caseId 取唯一活跃核查（1:1 首选读；无则 null）。真实开关关→走本地 store 派生。 */
    async fetchPreopSafetyCheckByCaseId(caseId: string): Promise<SafetyCheckRecord | null> {
      const remote = await fetchSafetyCheckByCaseId(caseId);
      if (remote) {
        const index = this.safetyChecks.findIndex((item) => item.caseId === caseId);
        if (index >= 0) this.safetyChecks[index] = remote;
        else this.safetyChecks.unshift(remote);
        return remote;
      }
      return this.safetyChecks.find((item) => item.caseId === caseId) ?? null;
    },
    /** 新增/更新安全核查（真实开关开→调 api；关→本地 upsert）。 */
    async upsertPreopSafetyCheck(record: SafetyCheckRecord) {
      const created = await upsertSafetyCheckRemote(record);
      const allComplete = record.signInComplete && record.timeOutComplete && record.signOutComplete;
      const finalRecord: SafetyCheckRecord = created ?? {
        ...record,
        status: allComplete ? '已完成' : '未完成',
      };
      if (created && /^\d+$/.test(created.id) && !/^\d+$/.test(record.id)) {
        finalRecord.id = created.id;
      }
      const index = this.safetyChecks.findIndex((item) => item.caseId === finalRecord.caseId);
      if (index >= 0) this.safetyChecks[index] = finalRecord;
      else this.safetyChecks.unshift(finalRecord);
      return finalRecord;
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
    applyTimelineNode(
      caseId: string,
      node: MethodTimelineNode,
      isoTime: string,
      options: {
        reason?: string;
        previousTime?: string;
        source?: string;
        overrideOrder?: boolean;
        clear?: boolean;
      } = {},
    ): number {
      const target = this.cases.find((entry) => entry.id === caseId);
      if (!target || target.locked) return this.recordPageDrafts[caseId] ?? 1;
      const reason = (options.reason ?? '').trim();
      const source = options.source ?? '人工录入';
      // HULI 原始值保护：入室/离室被覆盖前保留原始快照（不回写 HULI）。
      if (!options.clear) {
        if (node.syncField === 'roomInTime' && target.roomInTime && !target.originalRoomInTime) {
          target.originalRoomInTime = target.roomInTime;
        }
        if (node.syncField === 'leaveRoomTime' && target.leaveRoomTime && !target.originalLeaveRoomTime) {
          target.originalLeaveRoomTime = target.leaveRoomTime;
        }
      }
      if (options.clear) {
        clearTimelineNodeTime(target, node);
      } else {
        applyTimelineNodeTime(target, node, isoTime);
      }
      const clock = options.clear ? '已清除' : dayjs(isoTime).format('HH:mm');
      if (!target.recordSummary) target.recordSummary = {};
      if (!target.recordSummary.notes) target.recordSummary.notes = {};
      target.recordSummary.notes.keyOperations = options.clear
        ? removeTimedKeyOperationLine(target.recordSummary.notes.keyOperations, node.label)
        : upsertTimedKeyOperationLine(target.recordSummary.notes.keyOperations, node.label, clock);
      // 完整审计：原时间/新时间/原因/来源/顺序覆盖标记（不物理删除历史）。
      target.modificationLogs = target.modificationLogs ?? [];
      target.modificationLogs.unshift({
        id: `mod-${Date.now()}`,
        time: dayjs().toISOString(),
        operator: this.currentDoctorName,
        field: '关键时间',
        label: node.label,
        before: options.previousTime ?? '',
        after: options.clear ? '已清除' : isoTime,
        reason: reason || (options.clear ? '清除关键时间' : '时间轴节点'),
        status: target.locked ? '已记录' : options.overrideOrder ? '顺序覆盖修改' : '录入修改',
        timelineOrderOverride: options.overrideOrder === true,
        timelineSource: source,
      });
      this.syncRecordDocument(caseId);
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
      if (!options.clear && (node.key === 'room-in' || node.syncField === 'roomInTime')) {
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
      this.afterRecordMutation(caseId, { entityType: 'timeline_event', entityLocalId: target.events[target.events.length - 1]?.id, operationType: 'create', apiPath: ANESTHESIA_SYNC_QUEUE_API_PATH });
    },
    appendVital(caseId: string, vital: VitalSign) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked) return;
      target.vitals.push(vital);
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
      this.afterRecordMutation(caseId, { entityType: 'vital_sign', entityLocalId: vital.id, operationType: 'create', apiPath: ANESTHESIA_SYNC_QUEUE_API_PATH });
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
      this.afterRecordMutation(caseId, { entityType: 'vital_sign', entityLocalId: row.id, operationType: index >= 0 ? 'update' : 'create', apiPath: ANESTHESIA_SYNC_QUEUE_API_PATH });
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
      this.afterRecordMutation(caseId, { entityType: 'vital_sign', entityLocalId: vitalId, operationType: 'delete', apiPath: ANESTHESIA_SYNC_QUEUE_API_PATH });
    },
    appendMedication(caseId: string, medication: Omit<MedicationRecord, 'id'>) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked) return;
      target.medications.push({ id: `med-${Date.now()}`, ...medication });
      applySpecialNumbersToMedications(target.medications);
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
      this.afterRecordMutation(caseId, { entityType: 'medication', entityLocalId: target.medications[target.medications.length - 1]?.id, operationType: 'create', apiPath: ANESTHESIA_SYNC_QUEUE_API_PATH });
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
      this.afterRecordMutation(caseId, { entityType: 'medication', entityLocalId: row.id, operationType: index >= 0 ? 'update' : 'create', apiPath: ANESTHESIA_SYNC_QUEUE_API_PATH });
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
      this.afterRecordMutation(caseId, { entityType: 'medication', entityLocalId: medicationId, operationType: 'delete', apiPath: ANESTHESIA_SYNC_QUEUE_API_PATH });
    },
    appendFluid(caseId: string, fluid: Omit<FluidRecord, 'id'>) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked) return;
      const row: FluidRecord = { id: `fluid-${Date.now()}`, ...fluid };
      target.fluids.push(row);
      this.syncRecordDocument(caseId);
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
      const isTransfusion = row.category === '血液制品';
      this.afterRecordMutation(caseId, {
        entityType: isTransfusion ? 'transfusion' : 'fluid',
        entityLocalId: row.id,
        operationType: 'create',
        apiPath: ANESTHESIA_SYNC_QUEUE_API_PATH,
      });
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
      const isTransfusion = row.category === '血液制品';
      this.afterRecordMutation(caseId, {
        entityType: isTransfusion ? 'transfusion' : 'fluid',
        entityLocalId: row.id,
        operationType: index >= 0 ? 'update' : 'create',
        apiPath: ANESTHESIA_SYNC_QUEUE_API_PATH,
      });
    },
    deleteFluid(caseId: string, fluidId: string) {
      const target = this.cases.find((item) => item.id === caseId);
      if (!target || target.locked) return;
      const removed = target.fluids.find((item) => item.id === fluidId);
      const before = removed?.name;
      const isTransfusion = removed?.category === '血液制品';
      target.fluids = target.fluids.filter((item) => item.id !== fluidId);
      this.recordFieldChange(caseId, '输液/输血记录', before, '已删除', '右键/列表删除');
      syncCaseToDataset(getMutableDataset(), target);
      bumpDatasetVersion();
      this.datasetVersion += 1;
      this.afterRecordMutation(caseId, {
        entityType: isTransfusion ? 'transfusion' : 'fluid',
        entityLocalId: fluidId,
        operationType: 'delete',
        apiPath: ANESTHESIA_SYNC_QUEUE_API_PATH,
      });
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
      this.afterRecordMutation(caseId, {
        entityType: 'io_record',
        entityLocalId: row.id,
        operationType: index >= 0 ? 'update' : 'create',
        apiPath: ANESTHESIA_SYNC_QUEUE_API_PATH,
      });
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
      this.afterRecordMutation(caseId, {
        entityType: 'io_record',
        entityLocalId: outputId,
        operationType: 'delete',
        apiPath: ANESTHESIA_SYNC_QUEUE_API_PATH,
      });
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
      this.afterRecordMutation(caseId, { entityType: 'record', entityLocalId: caseId, operationType: 'update', apiPath: ANESTHESIA_SYNC_QUEUE_API_PATH });
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
      this.afterRecordMutation(caseId, {
        entityType: 'lab_result',
        entityLocalId: row.id,
        operationType: index >= 0 ? 'update' : 'create',
        apiPath: ANESTHESIA_SYNC_QUEUE_API_PATH,
      });
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
        fastingStatus?: NonNullable<SurgeryCase['preVisit']['fastingStatus']>;
        preMedications?: string;
        preoperativeConditions?: string;
        surgeryType?: NonNullable<SurgeryCase['surgeryType']>;
        surgeryLevel?: NonNullable<SurgeryCase['surgeryLevel']>;
        postoperativeDiagnosis?: string;
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
      if (patch.fastingStatus !== undefined) {
        const before = target.preVisit.fastingStatus ?? target.preVisit.fasting;
        target.preVisit.fastingStatus = patch.fastingStatus;
        target.preVisit.fasting = patch.fastingStatus;
        this.recordFieldChange(caseId, '禁食状态', before, patch.fastingStatus, reason);
      }
      if (patch.preMedications !== undefined) {
        const before = target.preVisit.preMedication;
        target.preVisit.preMedication = patch.preMedications;
        target.preVisit.preMedications = patch.preMedications.split('、').map((item) => item.trim()).filter(Boolean);
        this.recordFieldChange(caseId, '术前用药', before, patch.preMedications, reason);
      }
      if (patch.preoperativeConditions !== undefined) {
        const before = target.preVisit.specialCondition;
        target.preVisit.specialCondition = patch.preoperativeConditions;
        target.preVisit.preoperativeConditions = patch.preoperativeConditions.split('、').map((item) => item.trim()).filter(Boolean);
        this.recordFieldChange(caseId, '术前状况', before, patch.preoperativeConditions, reason);
      }
      if (patch.surgeryType !== undefined) {
        const before = target.surgeryType ?? target.urgency;
        target.surgeryType = patch.surgeryType;
        target.urgency = patch.surgeryType === '急诊' ? '急诊' : '择期';
        this.recordFieldChange(caseId, '手术类型', before, patch.surgeryType, reason);
      }
      if (patch.surgeryLevel !== undefined) {
        const before = target.surgeryLevel ?? '';
        target.surgeryLevel = patch.surgeryLevel;
        this.recordFieldChange(caseId, '手术等级', before, patch.surgeryLevel, reason);
      }
      if (patch.postoperativeDiagnosis !== undefined) {
        const before = target.postoperativeDiagnosis ?? '';
        target.postoperativeDiagnosis = patch.postoperativeDiagnosis;
        this.recordFieldChange(caseId, '术后诊断', before, patch.postoperativeDiagnosis, reason);
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
      this.afterRecordMutation(caseId, { entityType: 'record', entityLocalId: caseId, operationType: 'lock', apiPath: ANESTHESIA_SYNC_QUEUE_API_PATH });
      // 打印追溯：每次打印入队不可变 snapshot（服务端 immutable=1、snapshot_no 递增不覆盖）
      if (target.recordSnapshot) {
        this.afterRecordMutation(caseId, {
          entityType: 'snapshot',
          entityLocalId: `${caseId}-snapshot-${Date.now()}`,
          operationType: 'update',
          apiPath: ANESTHESIA_SYNC_QUEUE_API_PATH,
          payload: {
            snapshotAt: printedAt,
            snapshotReason: 'print',
            printedAt,
            operator: this.currentDoctorName,
            snapshot: target.recordSnapshot,
          },
        });
      }
      return true;
    },
    /**
     * Slice 3f —— 手动“从服务端重载”：强制拉取 getRecordDetail 聚合并覆盖本地内存态 + IndexedDB。
     * 锁定态记录回读为只读展示（reconstructed.locked=true，调用方据此禁止编辑）。
     * 返回重建后的 SurgeryCase，或 null（无服务端记录/mock 模式/请求失败）。
     */
    async reloadCaseFromServer(caseId: string) {
      const seed = this.cases.find((item) => item.id === caseId) ?? null;
      const reconstructed = await reloadCaseFromServer(caseId, seed);
      if (!reconstructed) return null;
      const index = this.cases.findIndex((item) => item.id === caseId);
      if (index >= 0) {
        this.cases[index] = reconstructed;
      } else {
        this.cases.push(reconstructed);
      }
      this.datasetVersion += 1;
      return reconstructed;
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
    async saveFluidDictEntry(item: FluidBloodDictItem): Promise<boolean> {
      const saved = await persistFluidDictItem(item);
      if (!saved) return false;
      const next = clone(this.configFluids);
      const index = next.findIndex((row) => row.id === item.id || (saved.id && row.id === saved.id));
      if (index >= 0) next[index] = saved;
      else next.push(saved);
      this.configFluids = next;
      this.persistRecordLocalState();
      return true;
    },
    async disableFluidDictEntry(item: FluidBloodDictItem): Promise<boolean> {
      const ok = await disableFluidDictItem(item);
      if (!ok) return false;
      this.configFluids = this.configFluids.filter((row) => row.id !== item.id && String(row.id) !== String(item.id));
      this.persistRecordLocalState();
      return true;
    },
    async saveVitalSignDictEntry(item: VitalSignDictItem): Promise<boolean> {
      const saved = await persistVitalDictItem(item);
      if (!saved) return false;
      const next = clone(this.configVitals);
      const index = next.findIndex((row) => row.id === item.id || (saved.id && row.id === saved.id));
      if (index >= 0) next[index] = saved;
      else next.push(saved);
      next.sort((a, b) => a.sortOrder - b.sortOrder);
      this.configVitals = next;
      this.persistRecordLocalState();
      return true;
    },
    async disableVitalSignDictEntry(id: string | number): Promise<boolean> {
      const ok = await disableVitalDictItem(id);
      if (!ok) return false;
      this.configVitals = this.configVitals.filter((row) => row.id !== id && String(row.id) !== String(id));
      this.persistRecordLocalState();
      return true;
    },
    async saveTemplateEntry(item: PrintTemplateItem): Promise<boolean> {
      const saved = await persistTemplateItem(item);
      if (!saved) return false;
      const next = clone(this.configTemplateItems);
      const index = next.findIndex((row) => row.id === item.id || (saved.id && row.id === saved.id));
      if (index >= 0) next[index] = saved;
      else next.push(saved);
      this.configTemplateItems = next;
      this.configPrintTemplates = next.map((row) => row.templateName).filter(Boolean);
      this.persistRecordLocalState();
      return true;
    },
    async disableTemplateEntry(id: string | number): Promise<boolean> {
      const ok = await disableTemplateItem(id);
      if (!ok) return false;
      this.configTemplateItems = this.configTemplateItems.filter((row) => row.id !== id && String(row.id) !== String(id));
      this.configPrintTemplates = this.configTemplateItems.map((row) => row.templateName).filter(Boolean);
      this.persistRecordLocalState();
      return true;
    },
    async saveStaffEntry(item: StaffDictItem): Promise<boolean> {
      const saved = await persistStaffItem(item);
      if (!saved) return false;
      const next = clone(this.configStaffItems);
      const index = next.findIndex((row) => row.id === item.id || (saved.id && row.id === saved.id));
      if (index >= 0) next[index] = saved;
      else next.push(saved);
      this.configStaffItems = next;
      this.configStaff = [...new Set(next.map((row) => row.name).filter(Boolean))];
      this.persistRecordLocalState();
      return true;
    },
    async disableStaffEntry(id: string | number): Promise<boolean> {
      const ok = await disableStaffItem(id);
      if (!ok) return false;
      this.configStaffItems = this.configStaffItems.filter((row) => row.id !== id && String(row.id) !== String(id));
      this.configStaff = [...new Set(this.configStaffItems.map((row) => row.name).filter(Boolean))];
      this.persistRecordLocalState();
      return true;
    },
    async saveDictListItem(listKey: 'configEvents' | 'configScores', categoryCode: string, name: string): Promise<boolean> {
      const ok = await persistDictListItem(categoryCode, name);
      if (!ok) return false;
      const current = this[listKey] as string[];
      if (!current.includes(name)) this[listKey] = [...current, name];
      this.persistRecordLocalState();
      return true;
    },
    async disableDictListItem(listKey: 'configEvents' | 'configScores', name: string): Promise<boolean> {
      const ok = await disableDictListItem(name);
      if (!ok) return false;
      this[listKey] = (this[listKey] as string[]).filter((value) => value !== name);
      this.persistRecordLocalState();
      return true;
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
    /** 加载用户列表（真实开关开→远程；关→清空回退本地 seed）。 */
    async loadRemoteAdminUsers(params?: { gh?: string; name?: string; groupid?: number }) {
      if (!useRealAdmin()) {
        this.remoteAdminUsers = [];
        this.remoteAdminUsersSource = 'mock';
        return { list: this.remoteAdminUsers, total: 0 };
      }
      const { list, total, source } = await loadAdminUsers(params);
      this.remoteAdminUsers = list;
      this.remoteAdminUsersSource = source;
      return { list, total };
    },
    /** 加载角色组列表（真实开关开→远程真组；关→清空）。 */
    async loadRemoteAdminUserGroups() {
      if (!useRealAdmin()) {
        this.remoteAdminUserGroups = [];
        this.remoteAdminUserGroupsSource = 'mock';
        return this.remoteAdminUserGroups;
      }
      const { list, source } = await loadAdminUserGroups();
      this.remoteAdminUserGroups = list;
      this.remoteAdminUserGroupsSource = source;
      return list;
    },
    /** 加载菜单树（getMenu，作用于当前登录用户 groupid；关→清空）。 */
    async loadRemoteMenuTree() {
      if (!useRealAdmin()) {
        this.remoteMenuTree = [];
        this.remoteMenuTreeSource = 'mock';
        return this.remoteMenuTree;
      }
      const { tree, source } = await loadMenuTree();
      this.remoteMenuTree = tree;
      this.remoteMenuTreeSource = source;
      return tree;
    },
    /** 新增用户（真实开关开→远程创建+刷新；关→本地 upsert）。 */
    async createSystemUser(input: AdminUserInput) {
      if (useRealAdmin()) {
        await createAdminUserRemote(input);
        await this.loadRemoteAdminUsers();
        return;
      }
      upsertSystemUser({
        id: input.id ? String(input.id) : `u-${Date.now()}`,
        username: input.username,
        name: input.name,
        role: input.role,
        department: input.department,
        active: true,
      });
    },
    /** 编辑用户（真实开关开→远程更新+刷新；关→本地 upsert）。 */
    async updateSystemUser(input: AdminUserInput) {
      if (useRealAdmin()) {
        await updateAdminUserRemote(input);
        await this.loadRemoteAdminUsers();
        return;
      }
      upsertSystemUser({
        id: String(input.id ?? ''),
        username: input.username,
        name: input.name,
        role: input.role,
        department: input.department,
        active: true,
      });
    },
    /** 删除用户（真实开关开→远程删除+刷新；关→本地移除）。 */
    async deleteSystemUser(id: string | number) {
      if (useRealAdmin()) {
        await deleteAdminUserRemote(id);
        await this.loadRemoteAdminUsers();
        return;
      }
      this.remoteAdminUsers = this.remoteAdminUsers.filter((u) => String(u.id) !== String(id));
    },
    /** 修改密码（真实开关开→远程 changePassword，作用于当前登录用户；关→空操作）。 */
    async changeSystemPassword(payload: { password: string; newPassword: string }) {
      if (useRealAdmin()) {
        await changePasswordRemote(payload);
      }
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
      // 真实模式下床位为后端权威，不在刷新时用 mock 重算覆盖（plan 实施说明）。
      if (!useRealPacu()) {
        this.pacuRooms = buildPacuRooms(this.cases);
      }
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
