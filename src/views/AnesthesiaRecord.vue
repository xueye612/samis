<template>
  <div v-if="current" class="anesthesia-record-workstation" :class="{ 'print-preview-active': printPreviewVisible }">
    <section class="record-topbar">
      <div class="topbar-main">
        <div class="brand-block">
          <a-button class="return-button" size="small" @click="goBackToSource">
            {{ returnTarget.label }}
          </a-button>
          <div class="brand-mark">麻</div>
          <div>
            <h1>麻醉记录单</h1>
            <p>{{ current.room }} · {{ current.patientName }} · {{ current.surgeryName }}</p>
          </div>
        </div>

        <div class="top-context">
          <span class="workflow-route">{{ returnTarget.contextLabel }} / 麻醉记录单</span>
          <a-tag :color="current.locked ? 'orangered' : current.rescue ? 'red' : 'green'">{{ current.locked ? '🔒 已锁定' : current.rescue ? '抢救中' : current.recordStatus ?? '记录中' }}</a-tag>
          <span>采集：{{ current.device?.collectStatus ?? current.collectStatus ?? '未连接' }}</span>
        </div>

        <a-space wrap>
          <a-button type="primary" :disabled="current.locked" @click="startRecord">启动记录</a-button>
          <a-button :disabled="current.locked" @click="importVitals">设备采集</a-button>
          <a-button status="danger" :disabled="current.locked" @click="enterRescue">抢救模式</a-button>
          <a-button v-if="current.rescue" status="warning" :disabled="current.locked" @click="exitRescue">退出抢救</a-button>
          <a-button @click="runQuality">完整性检查</a-button>
          <a-dropdown trigger="click">
            <a-button>更多</a-button>
            <template #content>
              <a-doption @click="saveDraft()">保存草稿</a-doption>
              <a-doption v-if="current.locked" @click="unlockCurrent">解锁修改</a-doption>
              <a-doption @click="printCurrent">打印预览</a-doption>
            </template>
          </a-dropdown>
          <a-button type="primary" status="success" :disabled="current.locked" @click="submitSignature">提交签名</a-button>
        </a-space>
      </div>

      <div class="topbar-footer">
        <a-space wrap>
          <a-button size="small" @click="patientPanelOpen = !patientPanelOpen">{{ patientPanelOpen ? '隐藏患者队列' : '展开患者队列' }}</a-button>
          <a-button size="small" @click="qualityPanelOpen = !qualityPanelOpen">{{ qualityPanelOpen ? '隐藏质控侧栏' : '展开质控侧栏' }}</a-button>
          <a-select
            :model-value="selectedId"
            size="small"
            class="compact-case-select"
            :options="sortedCases.map((item) => ({ label: `${item.room} ${item.patientName} ${item.surgeryName}`, value: item.id }))"
            @change="(value) => selectCase(String(value))"
          />
          <span v-if="livePageCount > 1" class="topbar-chip">记录 {{ livePageCount }} 页</span>
          <a-button
            v-for="event in topQuickEvents"
            :key="event.name"
            size="small"
            type="outline"
            :disabled="current.locked"
            @click="addEvent(event.name)"
          >{{ event.name }}</a-button>
        </a-space>
      </div>
    </section>

    <div class="record-layout" :class="{ 'queue-collapsed': !patientPanelOpen, 'quality-collapsed': !qualityPanelOpen }">
      <aside v-show="patientPanelOpen" class="patient-queue">
        <div class="queue-head">
          <strong>手术间患者</strong>
          <span>{{ sortedCases.length }}人</span>
        </div>
        <a-input-search v-model="keyword" placeholder="搜索患者/手术间" allow-clear />
        <div class="queue-list">
          <button
            v-for="item in filteredCases"
            :key="item.id"
            type="button"
            class="patient-card"
            :class="{ active: item.id === selectedId, rescue: Boolean(item.rescue) }"
            @click="selectCase(item.id)"
          >
            <div>
              <strong>{{ item.patientName }}</strong>
              <span>{{ item.gender }} · {{ item.age }}岁</span>
            </div>
            <p>{{ item.room }} · {{ item.department }}</p>
            <p>{{ item.surgeryName }}</p>
            <span class="card-status">{{ item.recordStatus ?? item.status }}</span>
          </button>
        </div>
      </aside>

      <main class="record-center">
        <div class="record-workspace">
          <section class="sheet-workbench">
            <div class="sheet-page-nav no-print">
              <a-pagination
                v-if="livePageCount > 1"
                v-model:current="livePageNo"
                :total="livePageCount"
                :page-size="1"
                simple
                size="small"
              />
              <span class="sheet-page-badge">第 {{ livePageNo }}/{{ livePageCount }} 页</span>
              <span v-if="livePageRange" class="sheet-page-range">{{ livePageRange }}</span>
            </div>
            <LiveAnesthesiaSheet
              ref="liveSheetRef"
              :record="current"
              :vitals="vitalCatalog"
              :drugs="drugCatalog"
              :fluids="fluidCatalog"
              :blood-types="store.configGenericDicts.bloodTypes"
              :rh-types="store.configGenericDicts.rhTypes"
              :transfusion-reactions="store.configGenericDicts.transfusionReactions"
              :monitor-order="monitorOrder"
              :read-only="current.locked"
              :page-no="livePageNo"
              :show-anesthesia-plane="sheetShowAnesthesiaPlane"
              :applied-template-name="sheetTemplateName"
              :applied-method-labels="sheetAppliedMethodLabels"
              :applied-modules="sheetAppliedModules"
              :template-impact="confirmedTemplateImpact"
              :recent-event-label="recentEventLabel"
              :method-keys="sheetMethodKeys"
              :method-labels="sheetAppliedMethodLabels"
              :method-primary="primaryMethod"
              :method-auxiliary="auxiliaryMethods"
              :header-picker-options="headerPickerOptions"
              @select-event="selectSheetEvent"
              @save-medication="saveMedication"
              @save-fluid="saveFluid"
              @save-vital="saveVital"
              @save-output="saveOutput"
              @save-plane="savePlane"
              @save-monitor-order="saveMonitorOrder"
              @delete-record="deleteRecord"
              @save-professional-field="saveProfessionalField"
              @save-timeline="saveTimelineNode"
              @save-header-field="saveHeaderField"
              @save-method-selection="applyMethodSelection"
              @save-summary-field="saveSummaryField"
              @save-summary-notes="saveSummaryNotes"
              @save-lab="saveLab"
              @layout-warnings="updateLayoutWarnings"
              @stop-medication-pump="stopPump"
            />
          </section>

          <aside ref="toolboxRef" class="record-toolbox">
            <a-card v-if="sheetMethodKeys.length" class="timeline-workbench-card" :bordered="false">
              <template #title>关键时间</template>
              <template #extra>
                <span class="timeline-card-extra">{{ timelineProgressLabel }}</span>
              </template>
              <p v-if="timelinePendingLabels" class="timeline-card-hint">待录：{{ timelinePendingLabels }}</p>
              <TimelineNodeRail
                :embedded="false"
                :show-header="false"
                :record="current"
                :method-keys="sheetMethodKeys"
                :method-labels="sheetAppliedMethodLabels"
                :locked="current.locked"
                :active-key="activeTimelineKey"
                @save="saveTimelineNode"
                @focus="focusWorkbenchTimelineNode"
              />
            </a-card>

            <IntraopWorkflowPanel
              :stage="currentStage"
              :stage-options="scenarioContext.stageOptions"
              :scenario="selectedScenario"
              :scenario-options="scenarioContext.scenarioOptions"
              :method-labels="appliedMethodLabels"
              :selected-template-name="selectedTemplateName"
              :recent-event-label="recentEventLabel"
              :quick-events="scenarioContext.quickEvents"
              :pending-items="pendingLandingItems"
              :completion-gaps="completionGaps"
              :recommended-items="scenarioContext.recommendedItems"
              :pending-guidance="scenarioContext.pendingItems"
              :risk-items="scenarioContext.risks"
              :next-steps="scenarioContext.nextSteps"
              :locked="current.locked"
              @update:stage="updateCurrentStage"
              @update:scenario="updateSurgeryScenario"
              @quick-event="addEvent"
              @focus-status-row="scrollToStatusRow"
              @confirm-all="confirmAllLandingItems"
              @confirm-item="confirmLandingItem"
            />

            <RecordQuickToolbar
              :record="current"
              :locked="current.locked"
              @stop-pump="stopPump"
              @open-data="openDataList"
            />

            <RecordRecentEntries :entries="recentEntries" @locate="locateRecentEntry" />

            <EventDetailPanel
              :event-name="selectedEventName"
              :fields="confirmedLandingItems"
              :completion-gaps="completionGaps"
              :field-values="current.professionalFieldValues"
              :locked="current.locked"
              :quick-events="scenarioContext.quickEvents"
              @save-field="saveProfessionalField"
              @select-event="addEvent"
            />

            <a-collapse v-model:active-key="toolboxCollapseKeys" :bordered="false" class="toolbox-collapse">
              <a-collapse-item key="templates" header="方案初始化" class="toolbox-collapse-item toolbox-collapse-templates">
                <AnesthesiaTemplateSelector compact :selected-template-name="selectedTemplateName" @apply="applyTemplate" />
              </a-collapse-item>
              <a-collapse-item key="methods" header="麻醉方式" class="toolbox-collapse-item toolbox-collapse-methods">
                <AnesthesiaTypeSelector
                  compact
                  :primary="primaryMethod"
                  :auxiliary="auxiliaryMethods"
                  @update:primary="updatePrimaryMethod"
                  @update:auxiliary="updateAuxiliaryMethods"
                />
              </a-collapse-item>
              <a-collapse-item key="modules" header="专业字段预览" class="toolbox-collapse-item toolbox-collapse-modules">
                <DynamicAnesthesiaModules
                  compact
                  :methods="selectedMethodKeys"
                  :focus-module-keys="scenarioContext.focusModuleKeys"
                  :field-values="current.professionalFieldValues"
                  :read-only="current.locked"
                  @save-field="saveProfessionalField"
                />
              </a-collapse-item>
            </a-collapse>
          </aside>
        </div>

        <a-collapse :bordered="false" class="record-detail-collapse">
          <a-collapse-item key="detail" header="数据明细（表格维护）">
            <RecordDetailTabs
              v-model:active-tab="activeTab"
              :record="current"
              :method-keys="selectedMethodKeys"
              :vital-items="vitalCatalog"
              :drug-items="drugCatalog"
              :fluid-items="fluidCatalog"
              :quality-checks="qualityChecks"
              :quality-defects="caseDefects"
              @event="addEvent"
              @drug="addDrug"
              @fluid="addFluid"
            />
          </a-collapse-item>
        </a-collapse>
      </main>

      <aside v-show="qualityPanelOpen" class="record-side record-side-stack">
        <RecordQualityPanel
          :record="current"
          :checks="qualityChecks"
          :abnormal-vitals="abnormalVitals"
          :quality-defects="caseDefects"
          @focus-defect="focusDefect"
          @handle-abnormal="openAbnormalHandler"
        />
        <RecordAuditPanel
          :logs="current.modificationLogs ?? []"
          :printed-at="current.printedAt"
          :locked="current.locked"
        />
      </aside>
    </div>

    <PrintPreview
      v-if="printPreviewVisible && current"
      :record="current"
      :vitals="vitalCatalog"
      :drugs="drugCatalog"
      :fluids="fluidCatalog"
      :blood-types="store.configGenericDicts.bloodTypes"
      :rh-types="store.configGenericDicts.rhTypes"
      :transfusion-reactions="store.configGenericDicts.transfusionReactions"
      :monitor-order="monitorOrder"
      :quality-checks="qualityChecks"
      :print-checks="printChecks"
      :layout-warning-count="current.layoutWarnings?.length ?? 0"
      :applied-template-name="sheetTemplateName"
      :applied-method-labels="sheetAppliedMethodLabels"
      :applied-modules="sheetAppliedModules"
      :template-impact="confirmedTemplateImpact"
      :method-keys="sheetMethodKeys"
      :show-anesthesia-plane="sheetShowAnesthesiaPlane"
      @close="printPreviewVisible = false"
      @print="executePrint"
      @confirm-print="confirmPrintAndLock"
    />

    <a-modal v-model:visible="qualityVisible" title="麻醉记录单完整性检查" width="760px" :footer="false">
      <a-alert v-if="caseDefects.length" type="warning" :show-icon="true" style="margin-bottom: 12px">
        当前病例存在 {{ caseDefects.length }} 条质控缺陷，请先在记录单中整改后再提交签名。
      </a-alert>
      <a-table :data="qualityChecks" :pagination="false" size="small">
        <template #columns>
          <a-table-column title="检查项" data-index="item" />
          <a-table-column title="状态" :width="100">
            <template #cell="{ record }"><a-tag :color="qualityColor(record.status)">{{ record.status }}</a-tag></template>
          </a-table-column>
          <a-table-column title="说明" data-index="message" />
          <a-table-column title="定位" data-index="target" :width="100" />
        </template>
      </a-table>
    </a-modal>

    <AnesthesiaTemplateApplyModal
      :visible="templateModalVisible"
      :draft="pendingTemplateDraft"
      @apply="confirmTemplateApply"
      @cancel="templateModalVisible = false"
    />

    <a-modal v-model:visible="abnormalVisible" title="异常生命体征处置" @ok="submitAbnormalHandling">
      <p>{{ abnormalTarget ? `${abnormalTarget.metric} ${abnormalTarget.value}${abnormalTarget.unit}` : '' }}</p>
      <a-textarea v-model="abnormalTreatment" placeholder="请输入处置措施" :auto-size="{ minRows: 3 }" />
    </a-modal>
  </div>
  <a-empty v-else description="暂无麻醉记录单病例" />
</template>

<script setup lang="ts">
import { Message } from '@arco-design/web-vue';
import dayjs from 'dayjs';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AnesthesiaTemplateApplyModal from '@/components/anesthesia/record/AnesthesiaTemplateApplyModal.vue';
import AnesthesiaTemplateSelector from '@/components/anesthesia/record/AnesthesiaTemplateSelector.vue';
import AnesthesiaTypeSelector from '@/components/anesthesia/record/AnesthesiaTypeSelector.vue';
import DynamicAnesthesiaModules from '@/components/anesthesia/record/DynamicAnesthesiaModules.vue';
import EventDetailPanel from '@/components/anesthesia/record/EventDetailPanel.vue';
import IntraopWorkflowPanel from '@/components/anesthesia/record/IntraopWorkflowPanel.vue';
import TimelineNodeRail from '@/components/anesthesia/record/TimelineNodeRail.vue';
import LiveAnesthesiaSheet from '@/components/anesthesia/record/LiveAnesthesiaSheet.vue';
import RecordDetailTabs from '@/components/anesthesia/record/RecordDetailTabs.vue';
import RecordRecentEntries from '@/components/anesthesia/record/RecordRecentEntries.vue';
import RecordQuickToolbar from '@/components/anesthesia/record/RecordQuickToolbar.vue';
import RecordQualityPanel from '@/components/anesthesia/record/RecordQualityPanel.vue';
import RecordAuditPanel from '@/components/anesthesia/record/RecordAuditPanel.vue';
import PrintPreview from '@/components/anesthesia/record/PrintPreview.vue';
import { buildSurgeryNameOptions, SURGICAL_POSITION_OPTIONS } from '@/config/recordHeaderOptions';
import { buildDrugCatalog, buildFluidCatalog, buildVitalCatalog, resolveDefaultMonitorOrder, runPrintPreflightChecks } from '@/services/anesthesiaRecordEngine';
import { buildRecordReturnTarget, buildRecordRoute, normalizeRecordEntrySource } from '@/services/recordNavigation';
import { buildRecordPagination } from '@/services/recordPaginationEngine';
import {
  buildCompletionGaps,
  buildConfirmedTemplateImpact,
  buildScenarioWorkflowContext,
  buildTemplateApplyDraft,
  buildTemplateLandingDraft,
  buildQuickEventPayload,
  deriveCurrentStage,
  deriveMethodSelectionFromCase,
  filterTemplateImpactForMethods,
  formatAnesthesiaMethodLabel,
  inferSurgeryScenarioFromCase,
  getDynamicModuleEntries,
  getQuickEventOption,
  getMethodLabels,
  hasAnesthesiaPlaneModule,
  mergeSelectedMethods,
  type AnesthesiaTemplateApplyDraft,
  type IntraopStage,
  type SurgeryScenarioKey,
  type TemplateLandingDraft,
} from '@/services/anesthesiaRecordMethodEngine';
import { sortCasesByClinicalPriority } from '@/services/scheduleHelpers';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import { anesthesiaMethodOptions } from '@/mock/anesthesiaRecordPrototype';
import type { AnesthesiaMethodKey, TemplateLandingItem, TemplateQualityTip } from '@/mock/anesthesiaRecordPrototype';
import type { MethodTimelineNode } from '@/services/methodTimelineEngine';
import { buildTimelineNodeStates, getMethodTimelineNodes } from '@/services/methodTimelineEngine';
import type { AbnormalVitalByDictionary } from '@/services/anesthesiaRecordEngine';
import type { QualityDefect } from '@/types/quality';
import type { RecordRecentEntry } from '@/types/recordRecent';
import type { AnesthesiaEvent, AnesthesiaPlaneRecord, FluidRecord, MedicationRecord, OutputDetailRecord, SurgeryCase, VitalSign } from '@/types/anesthesia';
import type { LabResultRecord, LayoutWarning } from '@/types/anesthesiaRecord';

const formatVitalLabel = (record: VitalSign) => {
  const metrics = ['HR', 'SBP', 'DBP', 'MAP', 'SpO2', 'RR', 'EtCO2', 'TEMP', 'BIS', 'CVP'] as const;
  const parts = metrics.filter((key) => record[key] !== undefined).map((key) => `${key} ${record[key]}`);
  return parts.join(' ') || '生命体征';
};
const DATA_LIST_LABELS: Record<'medications' | 'infusions' | 'vitals', string> = {
  medications: '用药',
  infusions: '输液',
  vitals: '体征',
};

interface RecordWorkflowDraft {
  selectedTab?: string;
  monitorOrder?: string[];
  lastSavedAt?: string;
  primaryMethod?: AnesthesiaMethodKey;
  auxiliaryMethods?: AnesthesiaMethodKey[];
  selectedTemplateName?: string;
  confirmedLandingItems?: TemplateLandingItem[];
  pendingLandingItems?: TemplateLandingItem[];
  confirmedQualityTips?: TemplateQualityTip[];
  manualStage?: IntraopStage | '';
  selectedScenario?: SurgeryScenarioKey;
}

const route = useRoute();
const router = useRouter();
const store = useAnesthesiaStore();

const selectedId = ref(String(route.params.id || store.currentDoctorActiveCase?.id || store.myTodayCases[0]?.id || store.cases[0]?.id || ''));
const activeTab = ref(String((store.recordDrafts[selectedId.value] as { selectedTab?: string } | undefined)?.selectedTab ?? 'patient'));
const keyword = ref('');
const qualityVisible = ref(false);
const patientPanelOpen = ref(false);
const qualityPanelOpen = ref(true);
const recentEntries = ref<RecordRecentEntry[]>([]);
const primaryMethod = ref<AnesthesiaMethodKey>('general');
const auxiliaryMethods = ref<AnesthesiaMethodKey[]>([]);
const selectedTemplateName = ref('');
const templateModalVisible = ref(false);
const pendingTemplateDraft = ref<TemplateLandingDraft | null>(null);
const pendingLandingItems = ref<TemplateLandingItem[]>([]);
const confirmedLandingItems = ref<TemplateLandingItem[]>([]);
const confirmedQualityTips = ref<TemplateQualityTip[]>([]);
const recentEventLabel = ref('');
const activeTimelineKey = ref('');
const selectedEventName = ref('');
const manualStage = ref<IntraopStage | ''>('');
const selectedScenario = ref<SurgeryScenarioKey>('generalSurgery');
const liveSheetRef = ref<{
  openDataList: (key: 'medications' | 'infusions' | 'transfusions' | 'vitals' | 'outputs' | 'planes') => void;
  flashEventType: (type: string) => void;
  focusTimelineNode: (node: MethodTimelineNode) => void;
  scrollStatusRowIntoView: () => void;
} | null>(null);
const abnormalVisible = ref(false);
const abnormalTarget = ref<AbnormalVitalByDictionary | null>(null);
const abnormalTreatment = ref('');
const printPreviewVisible = ref(false);
const livePageNo = ref(1);
const toolboxRef = ref<HTMLElement | null>(null);
const toolboxCollapseKeys = ref<Array<string | number>>(['templates']);

const ensureElementVisibleInScrollRoot = (element: HTMLElement, scrollRoot: HTMLElement, padding = 12) => {
  const rootRect = scrollRoot.getBoundingClientRect();
  const elRect = element.getBoundingClientRect();
  if (elRect.bottom > rootRect.bottom - padding) {
    scrollRoot.scrollTop += elRect.bottom - rootRect.bottom + padding;
  }
  if (elRect.top < rootRect.top + padding) {
    scrollRoot.scrollTop -= rootRect.top - elRect.top + padding;
  }
};

const scrollToolboxCollapseItem = async (key: string) => {
  await nextTick();
  await new Promise((resolve) => window.setTimeout(resolve, 240));
  const root = toolboxRef.value;
  if (!root) return;
  const item = root.querySelector(`.toolbox-collapse-${key}`) as HTMLElement | null;
  const content = item?.querySelector('.arco-collapse-item-content') as HTMLElement | null;
  const target = content ?? item;
  if (!target) return;
  ensureElementVisibleInScrollRoot(target, root);
};

watch(toolboxCollapseKeys, (keys, previous) => {
  const prev = previous ?? [];
  const opened = keys.filter((key) => !prev.includes(key));
  if (!opened.length) return;
  void scrollToolboxCollapseItem(String(opened[opened.length - 1]));
}, { deep: true });

const sortedCases = computed(() => sortCasesByClinicalPriority(store.cases));
const recordEntrySource = computed(() => normalizeRecordEntrySource(route.query.from));
const returnTarget = computed(() => buildRecordReturnTarget(recordEntrySource.value, selectedId.value));
const filteredCases = computed(() => {
  const text = keyword.value.trim();
  if (!text) return sortedCases.value;
  return sortedCases.value.filter((item) => [item.patientName, item.room, item.surgeryName, item.department].some((value) => value.includes(text)));
});
const current = computed(() => store.cases.find((item) => item.id === selectedId.value));
const livePagination = computed(() => (current.value ? buildRecordPagination(current.value) : null));
const livePageCount = computed(() => {
  const docCount = current.value?.recordDocument?.pageCount;
  if (docCount && docCount > 0) return docCount;
  return livePagination.value?.pages.length ?? 1;
});
const liveCurrentPageConfig = computed(() => {
  const pages = current.value?.recordDocument?.timeAxisPages?.length
    ? current.value!.recordDocument!.timeAxisPages
    : livePagination.value?.pages ?? [];
  return pages.find((item) => item.pageNo === livePageNo.value) ?? pages[0];
});
const livePageRange = computed(() => {
  const page = liveCurrentPageConfig.value;
  if (!page || livePageCount.value <= 1) return '';
  return `${page.pageStartTime} — ${page.pageEndTime}`;
});
const drugCatalog = computed(() => buildDrugCatalog(store.configDrugs));
const vitalCatalog = computed(() => buildVitalCatalog(store.configVitals));
const fluidCatalog = computed(() => buildFluidCatalog(store.configFluids));
const qualityChecks = computed(() => selectedId.value ? store.liveRecordQualityChecks(selectedId.value) : []);
const caseDefects = computed(() => selectedId.value ? store.caseQualityDefects(selectedId.value) : []);
const printChecks = computed(() => (current.value ? runPrintPreflightChecks(current.value, current.value.layoutWarnings ?? []) : []));
const abnormalVitals = computed(() => selectedId.value ? store.dictionaryDrivenAbnormalVitals(selectedId.value) : []);
const monitorOrder = computed(() => {
  const draft = store.recordDrafts[selectedId.value] as { monitorOrder?: string[] } | undefined;
  const saved = draft?.monitorOrder ?? [];
  if (saved.length) return saved;
  return resolveDefaultMonitorOrder(vitalCatalog.value);
});
const selectedMethodKeys = computed(() => mergeSelectedMethods(primaryMethod.value, auxiliaryMethods.value));
const appliedMethodLabels = computed(() => getMethodLabels(selectedMethodKeys.value));
const appliedModules = computed(() => getDynamicModuleEntries(selectedMethodKeys.value));
const defaultMethodSelection = computed(() => deriveMethodSelectionFromCase(current.value));
const defaultMethodKeys = computed(() => mergeSelectedMethods(defaultMethodSelection.value.primary, defaultMethodSelection.value.auxiliary));
const hasConfirmedTemplateLanding = computed(() => !selectedTemplateName.value || confirmedLandingItems.value.length > 0);
const sheetMethodKeys = computed(() => hasConfirmedTemplateLanding.value ? selectedMethodKeys.value : defaultMethodKeys.value);
const sheetTemplateName = computed(() => confirmedLandingItems.value.length ? selectedTemplateName.value : '');
const sheetAppliedMethodLabels = computed(() => getMethodLabels(sheetMethodKeys.value));
const sheetAppliedModules = computed(() => getDynamicModuleEntries(sheetMethodKeys.value));
const sheetShowAnesthesiaPlane = computed(() => hasAnesthesiaPlaneModule(sheetMethodKeys.value));
const timelineNodeStates = computed(() => (
  current.value ? buildTimelineNodeStates(current.value, sheetMethodKeys.value) : []
));
const timelineProgressLabel = computed(() => {
  const total = timelineNodeStates.value.length;
  const done = timelineNodeStates.value.filter((node) => node.recorded).length;
  return total ? `${done}/${total} 已记录` : '';
});
const timelinePendingLabels = computed(() => (
  timelineNodeStates.value.filter((node) => !node.recorded).map((node) => node.label).join('、')
));
const derivedStage = computed(() => current.value ? deriveCurrentStage(current.value) : '入室后');
const currentStage = computed(() => manualStage.value || derivedStage.value);
const confirmedTemplateImpact = computed(() => {
  const fieldItems = confirmedLandingItems.value.filter((item) => item.kind === 'field');
  if (!fieldItems.length && !confirmedQualityTips.value.length) return undefined;
  const impact = fieldItems.length ? buildConfirmedTemplateImpact(fieldItems) : { events: [], medications: [], monitorCodes: [], professionalFields: [], qualityTips: [] };
  impact.qualityTips = confirmedQualityTips.value;
  return filterTemplateImpactForMethods(impact, selectedMethodKeys.value);
});
const completionGaps = computed(() => current.value ? buildCompletionGaps(current.value, selectedMethodKeys.value, confirmedTemplateImpact.value) : []);
const scenarioContext = computed(() => current.value
  ? buildScenarioWorkflowContext({
    item: current.value,
    methods: selectedMethodKeys.value,
    scenario: selectedScenario.value,
    stage: currentStage.value,
    selectedTemplateName: selectedTemplateName.value,
    confirmedImpact: confirmedTemplateImpact.value,
  })
  : buildScenarioWorkflowContext({
    item: sortedCases.value[0]!,
    methods: selectedMethodKeys.value,
    scenario: selectedScenario.value,
    stage: currentStage.value,
    selectedTemplateName: selectedTemplateName.value,
    confirmedImpact: confirmedTemplateImpact.value,
  }));

const topQuickEvents = computed(() => scenarioContext.value.quickEvents.slice(0, 4));

const headerPickerOptions = computed(() => {
  const cases = store.cases;
  const unique = (values: Array<string | undefined>) => [...new Set(values.filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  const splitNames = (values: Array<string | undefined>, separator = '、') => unique(
    values.flatMap((value) => (value ? value.split(separator).map((item) => item.trim()) : [])),
  );
  return {
    positions: [...SURGICAL_POSITION_OPTIONS],
    surgeries: buildSurgeryNameOptions(cases, current.value?.surgeryName),
    anesthesiaMethods: unique([
      ...anesthesiaMethodOptions.map((item) => item.label),
      ...cases.map((item) => item.anesthesiaMethod),
    ]),
    anesthesiologists: splitNames([
      ...store.doctorOptions,
      ...cases.map((item) => item.anesthesiologist),
    ]),
    surgeons: splitNames(cases.map((item) => item.surgeon)),
    nurses: splitNames([
      ...store.configStaff,
      ...cases.map((item) => item.anesthesiaNurse),
      ...cases.map((item) => item.circulatingNurses),
      ...cases.map((item) => item.scrubNurses),
    ]),
  };
});

const readWorkflowDraft = (caseId: string): RecordWorkflowDraft => {
  const draft = store.recordDrafts[caseId];
  return draft && typeof draft === 'object' ? draft as RecordWorkflowDraft : {};
};

const restoreWorkflowState = (caseId: string) => {
  const draft = readWorkflowDraft(caseId);
  const selection = deriveMethodSelectionFromCase(current.value);
  primaryMethod.value = draft.primaryMethod ?? selection.primary;
  auxiliaryMethods.value = draft.auxiliaryMethods ?? selection.auxiliary;
  selectedTemplateName.value = draft.selectedTemplateName ?? '';
  pendingLandingItems.value = draft.pendingLandingItems ?? [];
  confirmedLandingItems.value = draft.confirmedLandingItems ?? [];
  confirmedQualityTips.value = draft.confirmedQualityTips ?? [];
  manualStage.value = draft.manualStage ?? '';
  selectedScenario.value = draft.selectedScenario ?? (current.value ? inferSurgeryScenarioFromCase(current.value) : 'generalSurgery');
  activeTab.value = draft.selectedTab ?? 'patient';
  recentEventLabel.value = '';
  selectedEventName.value = '';
  recentEntries.value = [];
  pendingTemplateDraft.value = null;
  templateModalVisible.value = false;
};

watch(() => route.params.id, (id) => {
  if (id) selectedId.value = String(id);
});
watch(selectedId, (id) => {
  livePageNo.value = 1;
  restoreWorkflowState(id);
  store.syncRecordDocument(id);
});
watch(livePageCount, (count) => {
  if (livePageNo.value > count) livePageNo.value = Math.max(1, count);
});
watch(activeTab, () => saveDraft(false));
watch([primaryMethod, auxiliaryMethods, selectedTemplateName, pendingLandingItems, confirmedLandingItems, manualStage, selectedScenario], () => saveDraft(false), { deep: true });

const selectCase = (id: string) => {
  selectedId.value = id;
  router.replace(buildRecordRoute(id, recordEntrySource.value));
};

onMounted(() => {
  restoreWorkflowState(selectedId.value);
  store.syncRecordDocument(selectedId.value);
});
const goBackToSource = () => router.push(returnTarget.value.path);
const requireCurrent = (): SurgeryCase | undefined => current.value;
const startRecord = () => {
  if (!requireCurrent()) return;
  store.startAnesthesiaRecord(selectedId.value);
};
const importVitals = () => {
  store.importDeviceVitalsLayered(selectedId.value);
  Message.success('设备采集数据已写入记录单');
};
const enterRescue = () => store.enterRescueRecordMode(selectedId.value);
const exitRescue = () => {
  store.exitRescueRecordMode(selectedId.value, '抢救结束，请补记相关记录');
  Message.success('已退出抢救模式');
};
const runQuality = () => {
  qualityVisible.value = true;
  activeTab.value = 'quality';
};
const saveDraft = (withLog = true) => {
  if (!selectedId.value) return;
  const currentDraft = readWorkflowDraft(selectedId.value);
  store.saveRecordDraft(selectedId.value, {
    ...currentDraft,
    selectedTab: activeTab.value,
    monitorOrder: monitorOrder.value,
    lastSavedAt: dayjs().toISOString(),
    primaryMethod: primaryMethod.value,
    auxiliaryMethods: auxiliaryMethods.value,
    selectedTemplateName: selectedTemplateName.value,
    pendingLandingItems: pendingLandingItems.value,
    confirmedLandingItems: confirmedLandingItems.value,
    confirmedQualityTips: confirmedQualityTips.value,
    manualStage: manualStage.value,
    selectedScenario: selectedScenario.value,
  });
  if (withLog && current.value) current.value.operationLogs = ['保存麻醉记录单草稿', ...(current.value.operationLogs ?? [])].slice(0, 8);
};
const unlockCurrent = () => {
  store.unlockRecord(selectedId.value, '记录单解锁后继续补记');
  Message.success('记录单已解锁，可继续修改');
};
const submitSignature = () => {
  store.syncDataset();
  if (qualityChecks.value.some((item) => item.status === '未通过')) {
    runQuality();
    return;
  }
  if (current.value) {
    current.value.signatures = {
      ...(current.value.signatures ?? { status: '未签名' }),
      anesthesiologist: current.value.anesthesiologist,
      nurse: current.value.anesthesiaNurse,
      surgeon: current.value.surgeon,
      signedAt: dayjs().toISOString(),
      status: '已签名',
    };
    current.value.recordStatus = '已锁定';
  }
  store.lockRecord(selectedId.value);
  store.syncDataset();
  Message.success('记录单已提交签名并锁定');
};
const printCurrent = () => {
  if (current.value) store.syncRecordDocument(selectedId.value);
  printPreviewVisible.value = true;
};
const executePrint = () => window.print();
const confirmPrintAndLock = () => {
  if (qualityChecks.value.some((item) => item.status === '未通过')) {
    runQuality();
    return;
  }
  store.printAndLockRecord(selectedId.value, '打印预览确认');
  printPreviewVisible.value = false;
  Message.success('记录单已打印锁定');
};
const saveLab = (record: LabResultRecord) => {
  store.upsertLabResult(selectedId.value, record);
  pushRecentEntry({
    kind: 'vital',
    label: `血气/检验 ${record.labType}`,
    time: record.resultTime,
    target: 'vitals',
    refId: record.id,
  });
};
const updateLayoutWarnings = (warnings: LayoutWarning[]) => {
  store.setLayoutWarnings(selectedId.value, warnings);
};
const applyTemplate = (templateName: string) => {
  pendingTemplateDraft.value = buildTemplateLandingDraft(templateName);
  templateModalVisible.value = true;
};
const confirmTemplateApply = (selection: AnesthesiaTemplateApplyDraft) => {
  primaryMethod.value = selection.primary;
  auxiliaryMethods.value = selection.auxiliary;
  selectedTemplateName.value = selection.templateName ?? '';
  const landingDraft = 'items' in selection ? selection as TemplateLandingDraft : buildTemplateLandingDraft(selection.templateName);
  pendingLandingItems.value = landingDraft.items;
  confirmedLandingItems.value = [];
  confirmedQualityTips.value = selection.impact.qualityTips;
  templateModalVisible.value = false;
  pendingTemplateDraft.value = null;
  Message.info(`已生成${pendingLandingItems.value.length}项待确认落单`);
};
const clearAppliedTemplateName = () => {
  selectedTemplateName.value = '';
  pendingLandingItems.value = [];
  confirmedLandingItems.value = [];
  confirmedQualityTips.value = [];
};
const updatePrimaryMethod = (value: AnesthesiaMethodKey) => {
  primaryMethod.value = value;
  auxiliaryMethods.value = auxiliaryMethods.value.filter((item) => item !== value);
  clearAppliedTemplateName();
};
const updateAuxiliaryMethods = (value: AnesthesiaMethodKey[]) => {
  auxiliaryMethods.value = value;
  clearAppliedTemplateName();
};
const updateCurrentStage = (stage: IntraopStage) => {
  manualStage.value = stage;
};
const updateSurgeryScenario = (scenario: SurgeryScenarioKey) => {
  selectedScenario.value = scenario;
};
const pushRecentEntry = (entry: Omit<RecordRecentEntry, 'id'>) => {
  recentEntries.value = [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...entry }, ...recentEntries.value].slice(0, 8);
};
const locateRecentEntry = (entry: RecordRecentEntry) => {
  if (entry.target === 'medication') {
    activeTab.value = 'medication';
    openDataList('medications');
    return;
  }
  if (entry.target === 'infusions') {
    activeTab.value = 'medication';
    openDataList('infusions');
    return;
  }
  if (entry.target === 'vitals') {
    activeTab.value = 'vitals';
    openDataList('vitals');
    return;
  }
  if (entry.target === 'timeline' && entry.refId) {
    activeTab.value = 'anesthesia';
    const node = getMethodTimelineNodes(sheetMethodKeys.value).find((item) => item.key === entry.refId);
    if (node) liveSheetRef.value?.focusTimelineNode(node);
    return;
  }
  activeTab.value = 'anesthesia';
  liveSheetRef.value?.flashEventType(entry.refId ?? entry.label);
};
const scrollToStatusRow = () => {
  activeTab.value = 'anesthesia';
  liveSheetRef.value?.scrollStatusRowIntoView();
};
const addEvent = (type: string) => {
  if (!current.value) return;
  const payload = buildQuickEventPayload(type, current.value);
  store.appendEvent(selectedId.value, payload);
  const option = getQuickEventOption(type);
  if (option.syncField && current.value) current.value[option.syncField] = payload.time;
  recentEventLabel.value = `${type} ${dayjs(payload.time).format('HH:mm')}`;
  selectedEventName.value = type;
  pushRecentEntry({ kind: 'event', label: type, time: payload.time, target: 'sheet-event', refId: type });
  activeTab.value = 'anesthesia';
  liveSheetRef.value?.flashEventType(type);
  Message.success(`已记录：${recentEventLabel.value}`);
};
const confirmLandingItem = (landingId: string) => {
  const item = pendingLandingItems.value.find((entry) => entry.landingId === landingId);
  if (!item) return;
  store.applyTemplateLandingItem(selectedId.value, { ...item, status: 'confirmed' });
  confirmedLandingItems.value = [...confirmedLandingItems.value, { ...item, status: 'confirmed' }];
  pendingLandingItems.value = pendingLandingItems.value.filter((entry) => entry.landingId !== landingId);
  if (item.kind === 'event') selectedEventName.value = item.label;
  pushRecentEntry({ kind: 'landing', label: item.label, time: dayjs().toISOString(), target: 'sheet-event', refId: item.label });
  saveDraft(false);
  Message.success(`已确认落单：${item.label}`);
};
const confirmAllLandingItems = () => {
  if (!pendingLandingItems.value.length) return;
  pendingLandingItems.value.forEach((item) => store.applyTemplateLandingItem(selectedId.value, { ...item, status: 'confirmed' }));
  confirmedLandingItems.value = [
    ...confirmedLandingItems.value,
    ...pendingLandingItems.value.map((item) => ({ ...item, status: 'confirmed' as const })),
  ];
  selectedEventName.value = pendingLandingItems.value.find((item) => item.kind === 'event')?.label ?? selectedEventName.value;
  const count = pendingLandingItems.value.length;
  pendingLandingItems.value = [];
  saveDraft(false);
  Message.success(`已确认${count}项落单`);
};
const saveProfessionalField = (group: string, label: string, value: string) => store.saveProfessionalField(selectedId.value, group, label, value);
const saveHeaderField = (patch: {
  actualSurgeryName?: string;
  position?: string;
  anesthesiologist?: string;
  surgeon?: string;
  anesthesiaNurse?: string;
  circulatingNurses?: string;
  scrubNurses?: string;
}) => {
  store.updateRecordHeaderField(selectedId.value, patch);
};
const applyMethodSelection = (payload: { primary: AnesthesiaMethodKey; auxiliary: AnesthesiaMethodKey[] }) => {
  updatePrimaryMethod(payload.primary);
  updateAuxiliaryMethods(payload.auxiliary);
  const label = formatAnesthesiaMethodLabel(mergeSelectedMethods(payload.primary, payload.auxiliary));
  store.updateRecordHeaderField(selectedId.value, { anesthesiaMethod: label });
  saveDraft(false);
};
watch(selectedMethodKeys, (keys) => {
  if (!selectedId.value || !current.value) return;
  const label = formatAnesthesiaMethodLabel(keys);
  if (current.value.anesthesiaMethod !== label) {
    store.updateRecordHeaderField(selectedId.value, { anesthesiaMethod: label }, '麻醉方式同步');
  }
});
const saveSummaryField = (patch: Partial<import('@/types/anesthesiaRecord').RecordSummaryFields>) => store.updateRecordSummary(selectedId.value, patch);
const saveSummaryNotes = (patch: Partial<import('@/types/anesthesiaRecord').RecordSummaryNotes>) => store.updateRecordSummaryNotes(selectedId.value, patch);
const saveTimelineNode = (node: MethodTimelineNode, isoTime: string) => {
  store.applyTimelineNode(selectedId.value, node, isoTime);
  activeTimelineKey.value = node.key;
  recentEventLabel.value = `${node.label} ${dayjs(isoTime).format('HH:mm')}`;
  pushRecentEntry({ kind: 'timeline', label: node.label, time: isoTime, target: 'timeline', refId: node.key });
  activeTab.value = 'anesthesia';
  liveSheetRef.value?.flashEventType(node.eventType ?? node.label);
  Message.success(`已更新：${node.label}`);
};
const focusWorkbenchTimelineNode = (node: MethodTimelineNode) => {
  activeTimelineKey.value = node.key;
  liveSheetRef.value?.focusTimelineNode(node);
};
const stopPump = (medicationId: string) => {
  store.stopMedication(selectedId.value, medicationId);
  Message.success('已停止持续泵入');
};
const openDataList = (key: 'medications' | 'infusions' | 'vitals') => {
  liveSheetRef.value?.openDataList(key);
  Message.info(`已在纸面下方「已录入数据维护」打开 · ${DATA_LIST_LABELS[key]}`);
};
const focusDefect = (defect: QualityDefect) => {
  qualityPanelOpen.value = true;
  activeTab.value = defect.source.includes('vital') ? 'vitals' : defect.source.includes('medication') ? 'medication' : 'quality';
  Message.info(`请处理：${defect.defectType}`);
};
const openAbnormalHandler = (item: AbnormalVitalByDictionary) => {
  abnormalTarget.value = item;
  abnormalTreatment.value = '';
  abnormalVisible.value = true;
};
const submitAbnormalHandling = () => {
  if (!abnormalTarget.value || !abnormalTreatment.value.trim()) {
    Message.warning('请填写处置措施');
    return;
  }
  const vitalKey = abnormalTarget.value.rowId ?? abnormalTarget.value.time;
  store.handleAbnormalVital(selectedId.value, vitalKey, abnormalTarget.value.metric, abnormalTreatment.value.trim());
  abnormalVisible.value = false;
  Message.success('异常生命体征处置已记录');
};
const addDrug = (name: string) => {
  store.appendMedicationFromDict(selectedId.value, name);
  pushRecentEntry({ kind: 'medication', label: name, time: dayjs().toISOString(), target: 'medication' });
  activeTab.value = 'medication';
};
const addFluid = (name: string) => {
  store.appendFluidFromDict(selectedId.value, name);
  pushRecentEntry({ kind: 'fluid', label: name, time: dayjs().toISOString(), target: 'infusions' });
  activeTab.value = 'medication';
};
const saveMedication = (record: MedicationRecord) => {
  store.upsertMedication(selectedId.value, record);
  pushRecentEntry({
    kind: 'medication',
    label: `${record.name} ${record.dose ?? ''}${record.unit ?? ''}`.trim(),
    time: record.time ?? record.startTime ?? dayjs().toISOString(),
    target: 'medication',
    refId: record.id,
  });
  activeTab.value = 'medication';
};
const saveFluid = (record: FluidRecord) => {
  store.upsertFluid(selectedId.value, record);
  pushRecentEntry({
    kind: 'fluid',
    label: `${record.name} ${record.volume ?? ''}${record.unit ?? ''}`.trim(),
    time: record.startTime ?? record.time ?? dayjs().toISOString(),
    target: 'infusions',
    refId: record.id,
  });
  activeTab.value = 'medication';
};
const saveVital = (record: VitalSign) => {
  store.upsertVital(selectedId.value, record);
  pushRecentEntry({
    kind: 'vital',
    label: formatVitalLabel(record),
    time: record.time,
    target: 'vitals',
    refId: record.id,
  });
  activeTab.value = 'vitals';
};
const saveOutput = (record: OutputDetailRecord) => store.upsertOutputRecord(selectedId.value, record);
const savePlane = (record: AnesthesiaPlaneRecord) => store.upsertAnesthesiaPlane(selectedId.value, record);
const saveMonitorOrder = (codes: string[]) => store.saveMonitorOrderDraft(selectedId.value, codes);
const deleteRecord = (kind: 'medication' | 'fluid' | 'vital' | 'output' | 'plane', id: string) => {
  if (!id) return;
  if (kind === 'medication') store.deleteMedication(selectedId.value, id);
  if (kind === 'fluid') store.deleteFluid(selectedId.value, id);
  if (kind === 'vital') store.deleteVital(selectedId.value, id);
  if (kind === 'output') store.deleteOutputRecord(selectedId.value, id);
  if (kind === 'plane') store.deleteAnesthesiaPlane(selectedId.value, id);
};
const selectSheetEvent = (event: Pick<AnesthesiaEvent, 'type'>) => {
  selectedEventName.value = event.type;
};
const qualityColor = (status: string) => status === '通过' ? 'green' : status === '警告' ? 'orange' : 'red';
</script>

<style scoped>
.anesthesia-record-workstation {
  display: grid;
  gap: 12px;
  margin: -12px;
  padding: 12px;
}

.record-topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid #e5edf5;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
}

.topbar-main {
  display: grid;
  grid-template-columns: minmax(360px, 440px) minmax(260px, 1fr) auto;
  gap: 12px;
  align-items: center;
}

.topbar-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid #eef2f7;
}

.work-mode-bar {
  display: none;
}

.compact-case-select {
  width: min(460px, 70vw);
}

.brand-block {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.return-button {
  flex: 0 0 auto;
  color: #165dff;
  background: #eef6ff;
}

.brand-mark {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 7px;
  color: #fff;
  font-weight: 800;
  background: linear-gradient(135deg, #165dff, #0f9f9a);
}

.brand-block h1,
.brand-block p {
  margin: 0;
}

.brand-block h1 {
  font-size: 18px;
}

.brand-block p,
.top-context {
  color: #64748b;
  font-size: 12px;
}

.top-context {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.workflow-route {
  padding: 2px 8px;
  border-radius: 999px;
  background: #eef6ff;
  color: #165dff;
}

.topbar-chip {
  padding: 2px 8px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #475569;
  font-size: 12px;
}

.record-layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr) 280px;
  gap: 12px;
  align-items: start;
}

.record-layout.queue-collapsed {
  grid-template-columns: minmax(0, 1fr) 280px;
}

.record-layout.quality-collapsed {
  grid-template-columns: 240px minmax(0, 1fr);
}

.record-layout.queue-collapsed.quality-collapsed {
  grid-template-columns: minmax(0, 1fr);
}

.patient-queue {
  position: sticky;
  top: 82px;
  display: grid;
  gap: 10px;
  max-height: calc(100vh - 110px);
  overflow: auto;
  padding: 12px;
  border: 1px solid #e5edf5;
  border-radius: 8px;
  background: #fff;
}

.queue-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.queue-list {
  display: grid;
  gap: 8px;
}

.patient-card {
  display: grid;
  gap: 5px;
  width: 100%;
  padding: 10px;
  border: 1px solid #e5edf5;
  border-radius: 8px;
  background: #fff;
  color: inherit;
  text-align: left;
}

.patient-card:hover,
.patient-card.active {
  border-color: #165dff;
  background: #f6fbff;
}

.patient-card.active {
  box-shadow: inset 3px 0 0 #165dff;
}

.patient-card.rescue {
  border-color: #fecaca;
  background: #fff7f7;
}

.patient-card div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.patient-card p {
  margin: 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.35;
}

.card-status {
  width: fit-content;
  padding: 2px 6px;
  border-radius: 999px;
  background: #eef6ff;
  color: #165dff;
  font-size: 12px;
}

.record-center {
  min-width: 0;
  display: grid;
  gap: 12px;
}

.record-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 14px;
  align-items: start;
}

.record-detail-collapse {
  margin-top: 4px;
  grid-column: 1 / -1;
}

.record-detail-collapse :deep(.arco-collapse-item-header) {
  font-size: 13px;
  color: #64748b;
}

.sheet-workbench {
  position: relative;
  min-width: 0;
  overflow: auto;
  padding: 10px;
  border: 1px solid #dbe6f3;
  border-radius: 8px;
  background: #f8fbff;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
}

.sheet-page-nav {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 8px;
  font-size: 12px;
  color: #64748b;
}

.sheet-page-badge {
  padding: 2px 10px;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 700;
}

.sheet-page-range {
  color: #475569;
  font-size: 11px;
}

.record-side-stack {
  display: grid;
  gap: 12px;
  align-content: start;
}

.record-toolbox {
  position: sticky;
  top: 96px;
  display: grid;
  gap: 10px;
  max-height: calc(100vh - 140px);
  overflow: auto;
  padding: 10px;
  border: 1px solid #dbe6f3;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.98);
}

.timeline-workbench-card {
  border: 1px solid #dbe6f3;
  background: #fff;
}

.timeline-workbench-card :deep(.arco-card-header) {
  min-height: 36px;
  padding: 8px 10px 0;
  border-bottom: 1px solid #edf2f7;
}

.timeline-workbench-card :deep(.arco-card-body) {
  padding: 8px 10px 10px;
}

.timeline-card-extra {
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 700;
}

.timeline-card-hint {
  margin: 0 0 6px;
  color: #92400e;
  font-size: 11px;
  line-height: 1.4;
}

.toolbox-header {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.event-feedback {
  margin-top: 10px;
}

.record-toolbox :deep(.arco-collapse-item-content-box) {
  padding: 8px 0 12px;
}

.toolbox-collapse :deep(.arco-collapse-item) {
  scroll-margin-bottom: 16px;
}

.record-side {
  position: sticky;
  top: 82px;
}

.record-audit-wrap {
  margin-top: 10px;
}

@media (max-width: 1280px) {
  .topbar-main {
    grid-template-columns: 1fr;
  }

  .record-workspace {
    grid-template-columns: minmax(0, 1fr) 320px;
  }
}

@media (max-width: 1200px) {
  .record-layout {
    grid-template-columns: 240px minmax(0, 1fr);
  }

  .record-layout.queue-collapsed {
    grid-template-columns: minmax(0, 1fr);
  }

  .record-side {
    position: static;
    grid-column: 1 / -1;
  }
}

@media (max-width: 1100px) {
  .record-workspace {
    grid-template-columns: 1fr;
  }

  .record-toolbox {
    position: static;
    max-height: none;
  }
}

@media (max-width: 900px) {
  .topbar-main,
  .record-layout {
    grid-template-columns: 1fr;
  }

  .record-workspace {
    grid-template-columns: 1fr;
  }

  .patient-queue {
    position: static;
    max-height: none;
  }
}

@page {
  size: A4 landscape;
  margin: 8mm;
}

@media print {
  :global(html),
  :global(body),
  :global(#app) {
    width: auto !important;
    min-width: 0 !important;
    margin: 0 !important;
    background: #fff !important;
  }

  .no-print {
    display: none !important;
  }

  .anesthesia-record-workstation.print-preview-active > .record-topbar,
  .anesthesia-record-workstation.print-preview-active > .record-layout {
    display: none !important;
  }

  .app-sider,
  .app-header,
  .app-subnav,
  .record-topbar,
  .work-mode-bar,
  .patient-queue,
  .record-toolbox,
  .record-side,
  .record-detail-tabs {
    display: none !important;
  }

  .anesthesia-record-workstation,
  .record-layout,
  .record-center {
    display: block !important;
    padding: 0 !important;
    margin: 0 !important;
    background: #fff !important;
  }

  .record-workspace,
  .sheet-workbench {
    display: block !important;
    padding: 0 !important;
    border: 0 !important;
    box-shadow: none !important;
    background: #fff !important;
    overflow: visible !important;
  }

  .anesthesia-record-workstation.print-preview-active .sheet-workbench .live-record-card {
    display: none !important;
  }
}
</style>
