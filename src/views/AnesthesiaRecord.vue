<template>
  <div v-if="store.isHydrating || routeCaseLoading" class="record-empty-page record-empty-page--loading">
    <a-spin :size="36" tip="正在加载手术通知单与字典数据…" />
  </div>
  <div
    v-else-if="current"
    class="anesthesia-record-workstation"
    :class="{ 'print-preview-active': printPreviewVisible }"
    :style="recordSheetShellStyle"
  >
    <RecordWorkstationTopbar
      :record="current"
      :return-label="returnTarget.label"
      :current-user-name="store.currentDoctorName"
      :sync-state="syncState"
      :selected-case-id="selectedId"
      :case-options="caseSelectOptions"
      :zoom-percent="sheetZoomPercent"
      :page-count="livePageCount"
      :locked="Boolean(current.locked)"
      :rescue-active="rescueModeActive"
      :device-collecting="deviceCollectingActive"
      :patient-panel-open="patientPanelOpen"
      :quality-panel-open="qualityPanelOpen"
      :actions="recordActions"
      @go-back="goBackToSource"
      @primary-action="handleRecordPrimaryAction"
      @save-draft="saveDraft()"
      @enter-rescue="enterRescue"
      @exit-rescue="exitRescue"
      @submit-signature="submitSignature"
      @unlock="unlockCurrent"
      @print="printCurrent"
      @quality-check="runQuality"
      @section-settings="sectionSettingsVisible = true"
      @toggle-patient-queue="patientPanelOpen = !patientPanelOpen"
      @toggle-quality-panel="qualityPanelOpen = !qualityPanelOpen"
      @decrease-zoom="decreaseSheetZoom"
      @increase-zoom="increaseSheetZoom"
      @fit-width="fitSheetWidth"
      @select-case="selectCase"
      @open-sync-detail="syncDetailVisible = true"
      @open-conflicts="conflictPanelVisible = true"
    />

    <div class="record-layout" :class="{ 'queue-collapsed': !patientPanelOpen, 'quality-collapsed': !qualityPanelOpen }">
      <aside v-show="patientPanelOpen" class="patient-queue">
        <div class="queue-head">
          <strong>手术间患者</strong>
          <span>{{ filteredCases.length }}/{{ sortedCases.length }}人</span>
        </div>
        <a-input-search v-model="keyword" placeholder="搜索患者/手术间" allow-clear />
        <div class="queue-filters">
          <a-select
            v-model="queueRoomFilter"
            size="mini"
            placeholder="手术间"
            allow-clear
            :options="queueRoomOptions"
          />
          <a-select
            v-model="queueStatusFilter"
            size="mini"
            placeholder="状态"
            allow-clear
            :options="queueStatusOptions"
          />
          <a-select
            v-model="queueRiskFilter"
            size="mini"
            placeholder="风险"
            allow-clear
            :options="queueRiskOptions"
          />
        </div>
        <div class="queue-list">
          <button
            v-for="item in filteredCases"
            :key="item.id"
            type="button"
            class="patient-card"
            :class="{ active: item.id === selectedId, rescue: isRescueModeActive(item) }"
            @click="selectCase(item.id)"
          >
            <div>
              <strong>{{ item.patientName }}</strong>
              <span>{{ item.gender }} · {{ item.age }}岁</span>
            </div>
            <p>{{ item.room }} · {{ item.department }}</p>
            <p>{{ item.surgeryName }}</p>
            <div class="patient-card-tags">
              <span class="card-status">{{ item.recordStatus ?? item.status }}</span>
              <span v-for="risk in patientRiskTags(item)" :key="risk" class="risk-tag">{{ risk }}</span>
            </div>
          </button>
        </div>
      </aside>

      <main class="record-center">
        <div class="record-workspace">
          <section class="sheet-workbench">
            <RecordSheetQuickStrip
              :entries="sheetQuickActions.entries"
              :primary-events="sheetQuickActions.primaryEvents"
              :more-events="sheetQuickActions.moreEvents"
              :has-more-events="sheetQuickActions.hasMoreEvents"
              @entry="handleSheetEntry"
              @quick-event="addEvent"
            />
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
            <div class="sheet-zoom-frame" :style="sheetZoomFrameStyle">
              <div v-if="!sheetReady" class="sheet-hydration-shell">
                <a-spin dot />
                <span>正在恢复本地记录…</span>
              </div>
              <LiveAnesthesiaSheet
                v-else
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
                :interaction-mode="sheetInteractionMode"
                :vital-display-interval-minutes="effectiveMonitorIntervalMinutes"
                :page-no="livePageNo"
                :show-anesthesia-plane="sheetShowAnesthesiaPlane"
                :section-visibility="sectionVisibility"
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
                @void-record="voidRecord"
                @restore-record="restoreRecord"
                @save-professional-field="saveProfessionalField"
                @save-timeline="saveTimelineNode"
                @save-header-field="saveHeaderField"
                @save-method-selection="applyMethodSelection"
                @save-summary-field="saveSummaryField"
                @save-summary-notes="saveSummaryNotes"
                @save-lab="saveLab"
                @layout-warnings="updateLayoutWarnings"
                @stop-medication-pump="stopPump"
                @section-visibility-reason="handleSectionVisibilityReason"
              />
            </div>
          </section>

          <aside ref="toolboxRef" class="record-toolbox" :class="{ collapsed: toolboxCollapsed }">
            <div class="toolbox-head no-print">
              <strong>记录辅助</strong>
              <a-button size="mini" type="text" @click="toolboxCollapsed = !toolboxCollapsed">
                {{ toolboxCollapsed ? '展开' : '收起' }}
              </a-button>
            </div>

            <template v-if="!toolboxCollapsed">
            <RecordQuickToolbar
              :record="current"
              :entries="sheetQuickActions.entries"
              :monitor-running="syncState.monitorRunning"
              :ventilator-running="syncState.ventilatorRunning"
              :conflict-count="syncState.conflictCount"
              :show-device="recordActions.showDeviceControls && showDeviceSimulationControls"
              @entry="handleSheetEntry"
              @stop-pump="stopPump"
              @open-data="openDataList"
              @toggle-monitor="toggleMonitorMock"
              @toggle-ventilator="toggleVentilatorMock"
              @import-vitals="importVitals"
              @open-sync-detail="syncDetailVisible = true"
              @open-conflicts="conflictPanelVisible = true"
              @open-quality="runQuality"
            />

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
              :case-item="current"
              @update:stage="updateCurrentStage"
              @update:scenario="updateSurgeryScenario"
              @quick-event="addEvent"
              @focus-status-row="scrollToStatusRow"
              @confirm-all="confirmAllLandingItems"
              @confirm-item="confirmLandingItem"
            />

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
              <RecordDeviceWorkbenchPanel
                v-if="showDeviceSimulationControls"
                :sync-state="syncState"
                :monitor-display-interval-minutes="monitorDisplayIntervalMinutes"
                :effective-interval-minutes="effectiveMonitorIntervalMinutes"
                :simulation-mode="deviceSimulationMode"
                :abnormal-types="abnormalSimulationTypes"
                :show-dev-conflict-button="showDevConflictButton"
                :locked="current.locked"
                :rescue-mode-active="rescueModeActive"
                :monitor-interval-options="monitorIntervalOptions"
                :monitoring-view="monitoringViewUi"
                @update:monitor-display-interval-minutes="monitorDisplayIntervalMinutes = $event"
                @update:simulation-mode="onDeviceSimulationModeChange"
                @update:abnormal-types="onAbnormalSimulationTypesChange"
                @import-vitals="importVitals"
                @toggle-monitor="toggleMonitorMock"
                @toggle-ventilator="toggleVentilatorMock"
                @stop-all-devices="stopAllDevices"
                @revoke-monitoring="revokeMonitoring"
                @inject-test-conflict="injectTestConflict"
                @open-sync-detail="syncDetailVisible = true"
                @open-conflicts="conflictPanelVisible = true"
              />
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
            </template>
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
          <a-collapse-item key="structured" header="结构化术中记录（气道/通气/输注/输血/抢救）">
            <StructuredClinicalEntitiesPanel
              :operation-id="current.id"
              :record-local-id="current.id"
              :read-only="current.locked || !canWriteStructuredRecord"
            />
          </a-collapse-item>
        </a-collapse>
      </main>

      <aside v-show="qualityPanelOpen" class="record-side record-side-stack">
        <RecordQualityPanel
          :record="current"
          :checks="qualityChecks"
          :abnormal-groups="panelAbnormalVitals"
          :quality-defects="caseDefects"
          :pending-fields="recordPendingFields"
          :device-collecting="deviceCollectingActive"
          @focus-defect="focusDefect"
          @handle-abnormal-group="openAbnormalGroupHandler"
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
      :section-visibility="sectionVisibility"
      :include-professional-appendix="includeProfessionalAppendix"
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

    <a-modal v-model:visible="syncDetailVisible" title="同步详情" :footer="false" width="420px" class="no-print">
      <div class="sync-detail-modal">
        <p v-if="syncState.localSavedAt"><strong>本地已保存</strong> {{ formatSyncTime(syncState.localSavedAt) }}</p>
        <p><strong>待上传</strong> {{ syncState.pendingCount }}</p>
        <p><strong>失败</strong> {{ syncState.failedCount }}</p>
        <p><strong>冲突</strong> {{ syncState.conflictCount }}</p>
        <p v-if="syncState.lastSyncSuccessAt"><strong>最近同步</strong> {{ formatSyncTime(syncState.lastSyncSuccessAt) }}</p>
        <p v-if="syncState.lastSyncError" class="sync-error-text">{{ syncState.lastSyncError }}</p>
        <a-button v-if="syncState.conflictCount > 0" size="small" type="outline" status="danger" @click="conflictPanelVisible = true; syncDetailVisible = false">
          打开冲突面板
        </a-button>
        <a-button size="small" type="outline" :loading="reloadingFromServer" @click="confirmReloadFromServer">
          从服务端重载记录
        </a-button>
      </div>
    </a-modal>

    <a-modal v-model:visible="abnormalVisible" title="异常生命体征处置" @ok="submitAbnormalHandling">
      <p>{{ abnormalTarget ? `${abnormalTarget.metric} ${abnormalTarget.value}${abnormalTarget.unit}` : '' }}</p>
      <a-textarea v-model="abnormalTreatment" placeholder="请输入处置措施" :auto-size="{ minRows: 3 }" />
    </a-modal>

    <a-modal v-model:visible="sectionSettingsVisible" title="纸面显示设置" :footer="false" width="540px">
      <p style="margin:0 0 12px;color:#64748b;font-size:13px;line-height:1.5;">隐藏不需要的区块可让记录单更简洁、打印更稳定。「自动」按本台手术是否用到来判断（如未用吸入麻醉/自体血即不显示）。</p>
      <div
        v-for="section in sectionOptions"
        :key="section.key"
        style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f0f2f5;"
      >
        <div style="min-width:0;">
          <strong style="display:block;font-size:13px;">{{ section.label }}</strong>
          <small style="color:#94a3b8;">{{ section.hint }}</small>
        </div>
        <a-radio-group
          :model-value="sectionVisibility[section.key] ?? 'auto'"
          type="button"
          size="small"
          @change="(value) => setSectionMode(section.key, String(value) as SectionVisibilityMode)"
        >
          <a-radio value="auto">自动</a-radio>
          <a-radio value="show">显示</a-radio>
          <a-radio value="hide">隐藏</a-radio>
        </a-radio-group>
      </div>
    </a-modal>

    <SyncConflictPanel
      v-model:visible="conflictPanelVisible"
      :case-id="selectedId"
      :load-conflicts="(caseId) => store.refreshSyncConflicts(caseId)"
      :on-resolve="(caseId, conflictId, action, merged) => store.resolveRecordSyncConflict(caseId, conflictId, action, merged)"
    />
  </div>
  <div v-else class="record-empty-page">
    <a-empty :description="recordEmptyDescription">
      <p class="record-empty-hint">{{ recordEmptyHint }}</p>
      <a-space>
        <a-button :loading="casesReloading" @click="reloadCases">重新加载手术列表</a-button>
        <a-button type="primary" @click="router.push('/surgery/schedule')">前往手术排班</a-button>
      </a-space>
    </a-empty>
  </div>
</template>

<script setup lang="ts">
import { Message, Modal } from '@arco-design/web-vue';
import { ANESTHESIA_USE_MOCK } from '@/api/samisResponse';
import { authApi } from '@/api/auth';
import { useRealAnesthesiaRecord, useRealAnesthesiaSync, useRealOperationInfo } from '@/config/apiFlags';
import dayjs from 'dayjs';
import { persistCaseNow, restoreCasePageNo } from '@/services/anesthesia/anesthesiaPersistenceBridge';
import { flushAnesthesiaSyncNow } from '@/services/anesthesia/anesthesiaSyncService';
import { getAnesthesiaLocalDb } from '@/services/anesthesia/localDb';
import {
  clampMonitorDisplayIntervalMinutes,
  MONITOR_DISPLAY_INTERVAL_STORAGE_KEY,
  readMonitorDisplayIntervalMinutes,
  resolveMonitorDisplayIntervalMinutes,
} from '@/services/anesthesia/monitorMockService';
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
import RecordDeviceWorkbenchPanel from '@/components/anesthesia/record/RecordDeviceWorkbenchPanel.vue';
import StructuredClinicalEntitiesPanel from '@/components/anesthesia/record/StructuredClinicalEntitiesPanel.vue';
import RecordWorkstationTopbar from '@/components/anesthesia/record/RecordWorkstationTopbar.vue';
import RecordSheetQuickStrip from '@/components/anesthesia/record/RecordSheetQuickStrip.vue';
import { buildRecordActionVisibility, buildRecordEntryVisibility } from '@/services/anesthesia/recordActionRules';
import { resolveSheetQuickEvents, type SheetEntryAction } from '@/services/anesthesia/recordQuickActions';
import { resolveRecordSheetNowIso } from '@/services/anesthesiaRecordEngine';
import RecordAuditPanel from '@/components/anesthesia/record/RecordAuditPanel.vue';
import PrintPreview from '@/components/anesthesia/record/PrintPreview.vue';
import SyncConflictPanel from '@/components/anesthesia/record/SyncConflictPanel.vue';
import { buildSurgeryNameOptions, SURGICAL_POSITION_OPTIONS } from '@/config/recordHeaderOptions';
import { OPTIONAL_RECORD_SECTIONS, resolveSectionVisible, type RecordSectionKey, type RecordSectionVisibility, type SectionVisibilityMode } from '@/config/recordSections';
import type { AggregatedAbnormalVital } from '@/services/anesthesiaRecordEngine';
import { buildDrugCatalog, buildFluidCatalog, buildVitalCatalog, buildRecordSummaryFields, isRescueModeActive, resolveDefaultMonitorOrder, runPrintPreflightChecks } from '@/services/anesthesiaRecordEngine';
import { buildRecordPendingFields } from '@/services/anesthesia/recordFieldCompleteness';
import {
  readAbnormalSimulationTypes,
  readDeviceSimulationMode,
  type AbnormalSimulationType,
  type DeviceSimulationMode,
} from '@/services/anesthesia/deviceSimulationMode';
import {
  getMonitoringRegistry,
  resolveMonitoringViewUi,
} from '@/services/anesthesia/monitoringSessionService';
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
  isQuickEventDone,
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
  sectionVisibility?: RecordSectionVisibility;
}

const route = useRoute();
const router = useRouter();
const store = useAnesthesiaStore();
const syncState = computed(() => store.anesthesiaSyncState);
const monitorDisplayIntervalMinutes = ref(readMonitorDisplayIntervalMinutes());
const deviceSimulationMode = ref<DeviceSimulationMode>(readDeviceSimulationMode());
const abnormalSimulationTypes = ref<AbnormalSimulationType[]>(readAbnormalSimulationTypes());
const showE2eActions = computed(() => import.meta.env.DEV || (typeof localStorage !== 'undefined' && localStorage.getItem('samis.e2e') === '1'));
const showDevConflictButton = computed(() => import.meta.env.DEV && ANESTHESIA_USE_MOCK);
const recordPermissions = ref<string[]>([]);
const canWriteStructuredRecord = computed(() => recordPermissions.value.some((code) => code === '*' || code === 'record.*' || code === 'record.write'));
const loadRecordPermissions = async () => {
  try {
    const result = await authApi.myPermissions();
    recordPermissions.value = Array.isArray(result?.permissions) ? result.permissions.map(String) : [];
  } catch {
    recordPermissions.value = [];
  }
};
const showDeviceSimulationControls = computed(() => (!useRealAnesthesiaRecord() && ANESTHESIA_USE_MOCK) || (
  import.meta.env.DEV && import.meta.env.VITE_SAMIS_DEVICE_SIMULATION === '1'
));
const monitorIntervalOptions = [1, 2, 3, 4, 5].map((value) => ({ label: `${value} 分钟/条`, value }));
watch(monitorDisplayIntervalMinutes, (value) => {
  const minutes = clampMonitorDisplayIntervalMinutes(value);
  monitorDisplayIntervalMinutes.value = minutes;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(MONITOR_DISPLAY_INTERVAL_STORAGE_KEY, String(minutes));
  }
});
const sheetReady = computed(() => store.localPersistenceReady && !store.isHydrating && caseSheetReady.value);
const formatSyncTime = (value?: string) => (value ? dayjs(value).format('HH:mm:ss') : '');
const UI_SMOKE_OPERATION_PREFIX = /^OP-E2E-(?:SCHEDULE|NATURAL)-/;

interface UiSmokeSyntheticResult {
  operationId: string;
  recordLocalId: string;
  local: {
    record: boolean;
    queueEntityTypes: string[];
  };
}

interface UiSmokeReloadResult {
  operationId: string;
  record: boolean;
  timelineEvents: number;
  medications: number;
  vitalSigns: number;
}

const canExposeUiSmokeHarness = () => import.meta.env.DEV
  && import.meta.env.VITE_SAMIS_REAL_INTEGRATION === '1'
  && useRealAnesthesiaRecord()
  && useRealAnesthesiaSync();

const buildUiSmokeCase = (seed: SurgeryCase): SurgeryCase => {
  const operationId = seed.id;
  const eventTime = seed.plannedStart || new Date().toISOString();
  return ({
  ...seed,
  status: '麻醉中',
  locationType: '手术室内',
  scheduledStart: eventTime,
  actualStart: eventTime,
  anesthesiaStart: eventTime,
  expectedDurationMinutes: 90,
  recordStatus: '采集中',
  collectStatus: '手工录入',
  vitalFrequency: '5分钟',
  locked: false,
  activeWarming: false,
  autologousBlood: false,
  postoperativeAnalgesia: false,
  preVisit: {
    completed: true,
    height: 170,
    weight: 65,
    asa: 'II',
    allergy: '无',
    anesthesiaHistory: '无',
    difficultAirway: '无',
    fasting: '8h',
    preMedication: '无',
    specialCondition: 'E2E UI smoke',
    plan: '全身麻醉',
    doctorSignature: 'quality_admin',
  },
  vitals: [{
    id: `vital-e2e-ui-${operationId}`,
    time: eventTime,
    HR: 80,
    SBP: 120,
    DBP: 70,
    MAP: 87,
    SpO2: 99,
    source: '手工录入',
    status: 'active',
  }],
  events: [{
    id: `timeline-e2e-ui-${operationId}`,
    type: '入室',
    time: eventTime,
    stage: '诱导期',
    severity: '轻度',
    treatment: 'E2E UI smoke event',
    staff: ['quality_admin'],
    reported: false,
    qualityIncluded: false,
    status: 'active',
  }],
  medications: [{
    id: `med-e2e-ui-${operationId}`,
    mode: '单次用药',
    time: eventTime,
    eventTime,
    drug: 'E2E_TEST_UI_丙泊酚',
    dose: 100,
    unit: 'mg',
    route: 'iv',
    executor: 'quality_admin',
    displayText: 'E2E_TEST_UI_丙泊酚 100mg',
    drugCategory: 'anesthetic',
    status: 'active',
  }],
  fluids: [],
  outputs: {
    urine: 0,
    bloodLoss: 0,
    drainage: 0,
  },
  outputRecords: [],
  labResults: [],
  });
};

const inspectUiSmokeLocalState = async (operationId: string) => {
  const db = getAnesthesiaLocalDb();
  const [record, queueRows] = await Promise.all([
    db.records.get(operationId),
    db.sync_queue.where('record_local_id').equals(operationId).toArray(),
  ]);
  return {
    record: Boolean(record),
    queueEntityTypes: queueRows.map((row) => row.entity_type).sort(),
  };
};

const selectedId = ref(String(route.params.id || store.currentDoctorActiveCase?.id || store.myTodayCases[0]?.id || store.cases[0]?.id || ''));
const activeTab = ref(String((store.recordDrafts[selectedId.value] as { selectedTab?: string } | undefined)?.selectedTab ?? 'patient'));
const keyword = ref('');
const queueRoomFilter = ref('');
const queueStatusFilter = ref('');
const queueRiskFilter = ref('');
const qualityVisible = ref(false);
const patientPanelOpen = ref(false);
const qualityPanelOpen = ref(false);
const toolboxCollapsed = ref(false);
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
const sectionVisibility = ref<RecordSectionVisibility>({});
const sectionReasonLogState = ref<{ inhaled: string; autologous: string }>({ inhaled: '', autologous: '' });
const sectionSettingsVisible = ref(false);
const sectionOptions = OPTIONAL_RECORD_SECTIONS;
const setSectionMode = (key: RecordSectionKey, mode: SectionVisibilityMode) => {
  sectionVisibility.value = { ...sectionVisibility.value, [key]: mode };
};
const liveSheetRef = ref<{
  openDataList: (key: 'medications' | 'infusions' | 'transfusions' | 'vitals' | 'outputs' | 'planes') => void;
  flashEventType: (type: string) => void;
  focusTimelineNode: (node: MethodTimelineNode) => void;
  scrollStatusRowIntoView: () => void;
  openMedicationEntry: () => void;
  openInfusionEntry: () => void;
  openTransfusionEntry: () => void;
  openVitalEntry: () => void;
  openOutputEntry: (type?: string) => void;
  openLabEntry: () => void;
} | null>(null);
const abnormalVisible = ref(false);
const abnormalTarget = ref<AbnormalVitalByDictionary | null>(null);
const abnormalTreatment = ref('');
const printPreviewVisible = ref(false);
const conflictPanelVisible = ref(false);
const syncDetailVisible = ref(false);
const caseSheetReady = ref(false);
const livePageNo = ref(1);
const sheetZoom = ref(1);
const BASE_SHEET_SKELETON_HEIGHT = 720;
const sheetSkeletonHeightPx = computed(() => {
  const multiPageBoost = livePageCount.value > 1 ? 40 : 0;
  return Math.round(BASE_SHEET_SKELETON_HEIGHT * sheetZoom.value + multiPageBoost);
});
const recordSheetShellStyle = computed(() => ({
  '--record-sheet-skeleton-height': `${sheetSkeletonHeightPx.value}px`,
}));
const sheetZoomFrameStyle = computed(() => ({
  '--sheet-zoom': String(sheetZoom.value),
  minHeight: `${Math.max(640, sheetSkeletonHeightPx.value - 40)}px`,
}));
const toolboxRef = ref<HTMLElement | null>(null);
const toolboxCollapseKeys = ref<Array<string | number>>([]);

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
const queueRoomOptions = computed(() => [...new Set(sortedCases.value.map((item) => item.room))].map((room) => ({ label: room, value: room })));
const queueStatusOptions = computed(() => [...new Set(sortedCases.value.map((item) => item.recordStatus ?? item.status))].map((status) => ({ label: status, value: status })));
const queueRiskOptions = [
  { label: '抢救', value: '抢救' },
  { label: '缺体温', value: '缺体温' },
  { label: '未签名', value: '未签名' },
  { label: 'PACU待转出', value: 'PACU待转出' },
];
const recordEntrySource = computed(() => normalizeRecordEntrySource(route.query.from));
const returnTarget = computed(() => buildRecordReturnTarget(recordEntrySource.value, selectedId.value));
const filteredCases = computed(() => {
  const text = keyword.value.trim();
  return sortedCases.value.filter((item) => {
    const matchesKeyword = !text || [item.patientName, item.room, item.surgeryName, item.department].some((value) => value.includes(text));
    const matchesRoom = !queueRoomFilter.value || item.room === queueRoomFilter.value;
    const matchesStatus = !queueStatusFilter.value || (item.recordStatus ?? item.status) === queueStatusFilter.value;
    const matchesRisk = !queueRiskFilter.value || patientRiskTags(item).includes(queueRiskFilter.value);
    return matchesKeyword && matchesRoom && matchesStatus && matchesRisk;
  });
});
const current = computed(() => store.cases.find((item) => item.id === selectedId.value));

const recordEmptyDescription = computed(() => {
  if (!store.cases.length) {
    return useRealOperationInfo() ? '当日手术通知单暂无数据' : '暂无麻醉记录单病例';
  }
  if (selectedId.value && !current.value) {
    return '当前选中的病例不在列表中';
  }
  return '请选择一名患者';
});

const recordEmptyHint = computed(() => {
  const parts: string[] = [];
  if (store.operationListSource) {
    parts.push(`数据来源：${store.operationListSource === 'remote' ? '远程接口' : store.operationListSource}`);
  }
  parts.push(`已加载 ${store.cases.length} 条手术`);
  if (useRealOperationInfo() && !store.cases.length) {
    parts.push('可在手术排班切换日期后刷新，或联系后台确认当日通知单');
  }
  return parts.join(' · ');
});
const caseSelectOptions = computed(() => sortedCases.value.map((item) => ({
  label: `${item.room} ${item.patientName}`,
  value: item.id,
})));
const recordActions = computed(() => buildRecordActionVisibility(current.value, rescueModeActive.value));
const sheetQuickActions = computed(() => {
  if (!current.value) {
    return {
      entries: buildRecordEntryVisibility(undefined, false),
      primaryEvents: [],
      moreEvents: [],
      hasMoreEvents: false,
    };
  }
  return resolveSheetQuickEvents(
    current.value,
    currentStage.value,
    selectedMethodKeys.value,
    selectedTemplateName.value,
    selectedScenario.value,
    rescueModeActive.value,
  );
});
const monitoringViewUi = computed(() => resolveMonitoringViewUi(selectedId.value, getMonitoringRegistry()));
const deviceCollectingActive = computed(() => (
  monitoringViewUi.value.mockTicking || monitoringViewUi.value.monitoringPaused
));
const rescueModeActive = computed(() => (current.value ? isRescueModeActive(current.value) : false));
const effectiveMonitorIntervalMinutes = computed(() => resolveMonitorDisplayIntervalMinutes({
  rescueMode: rescueModeActive.value,
  simulationMode: deviceSimulationMode.value,
  displayIntervalMinutes: monitorDisplayIntervalMinutes.value,
}));
const recordPendingFields = computed(() => {
  if (!current.value) return [];
  const summary = buildRecordSummaryFields(current.value);
  return buildRecordPendingFields(current.value, summary);
});
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
const panelAbnormalVitals = computed(() => selectedId.value ? store.panelAbnormalVitals(selectedId.value) : []);
const sheetInteractionMode = computed(() => {
  if (printPreviewVisible.value) return 'print';
  if (current.value?.locked) return 'view';
  return 'edit';
});
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
const sheetShowAnesthesiaPlane = computed(() => resolveSectionVisible(sectionVisibility.value.plane, hasAnesthesiaPlaneModule(sheetMethodKeys.value)));
const includeProfessionalAppendix = computed(() => resolveSectionVisible(sectionVisibility.value.professionalAppendix, false));
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

const sheetZoomPercent = computed(() => Math.round(sheetZoom.value * 100));

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
  sectionVisibility.value = draft.sectionVisibility ?? {};
  activeTab.value = draft.selectedTab ?? 'patient';
  recentEventLabel.value = '';
  selectedEventName.value = '';
  recentEntries.value = [];
  pendingTemplateDraft.value = null;
  templateModalVisible.value = false;
};

const casesReloading = ref(false);
const routeCaseLoading = ref(false);

const ensureRouteCaseLoaded = async () => {
  const routeId = route.params.id ? String(route.params.id) : '';
  if (!routeId || !useRealOperationInfo()) return null;
  const existing = store.cases.find((item) => item.id === routeId);
  if (existing) return existing;
  routeCaseLoading.value = true;
  try {
    const loaded = await store.loadOperationCaseById(routeId);
    if (!loaded) Message.warning('手术通知单不存在');
    return loaded;
  } finally {
    routeCaseLoading.value = false;
  }
};

const resolveActiveCaseId = () => {
  const routeId = route.params.id ? String(route.params.id) : '';
  if (routeId && store.cases.some((item) => item.id === routeId)) return routeId;
  return (
    store.currentDoctorActiveCase?.id
    || store.myTodayCases[0]?.id
    || store.cases[0]?.id
    || ''
  );
};

const prepareCurrentCaseView = async (caseId: string) => {
  if (!store.localPersistenceReady) {
    await store.bootstrapAnesthesiaLocalPersistence();
  }
  await store.setActiveAnesthesiaRecordScope(caseId);
  livePageNo.value = await restoreCasePageNo(caseId);
  restoreWorkflowState(caseId);
  store.syncRecordDocument(caseId);
  store.setRecordPageDraft(caseId, livePageNo.value);
  caseSheetReady.value = true;
};

let syncingCaseSelection = false;

const syncActiveCaseSelection = async () => {
  if (syncingCaseSelection) return;
  if (!store.localPersistenceReady || store.isHydrating) return;
  await ensureRouteCaseLoaded();
  const nextId = resolveActiveCaseId();
  if (!nextId) return;
  syncingCaseSelection = true;
  try {
    if (nextId !== selectedId.value) {
      selectedId.value = nextId;
    }
    const routeId = route.params.id ? String(route.params.id) : '';
    if (routeId !== nextId) {
      await router.replace(buildRecordRoute(nextId, recordEntrySource.value));
    }
  } finally {
    syncingCaseSelection = false;
  }
};

const reloadCases = async () => {
  casesReloading.value = true;
  try {
    await store.loadRemoteOperationList({ operationDate: dayjs().format('YYYY-MM-DD') });
    await ensureRouteCaseLoaded();
    await syncActiveCaseSelection();
    if (!store.cases.length) Message.info('仍未获取到手术病例');
  } finally {
    casesReloading.value = false;
  }
};

// Slice 3f —— 手动“从服务端重载”：强制拉取 getRecordDetail 聚合并覆盖本地。
const reloadingFromServer = ref(false);
const confirmReloadFromServer = () => {
  const caseId = selectedId.value;
  if (!caseId) {
    Message.warning('未选中记录');
    return;
  }
  const locked = current.value?.locked;
  Modal.warning({
    title: '从服务端重载记录',
    content: locked
      ? '该记录已锁定，重载后为只读展示。确定用服务端数据覆盖本地？'
      : '确定用服务端数据覆盖本地当前记录？未上传的本地改动将被替换。',
    hideCancel: false,
    okText: '重载',
    cancelText: '取消',
    onOk: async () => {
      reloadingFromServer.value = true;
      try {
        const reconstructed = await store.reloadCaseFromServer(caseId);
        if (!reconstructed) {
          Message.warning('服务端无该记录的可读数据');
          return;
        }
        syncDetailVisible.value = false;
        Message.success(reconstructed.locked ? '已从服务端重载（只读）' : '已从服务端重载');
      } finally {
        reloadingFromServer.value = false;
      }
    },
  });
};

watch(() => route.params.id, (id) => {
  if (id) selectedId.value = String(id);
  void syncActiveCaseSelection();
});
watch(
  () => [store.localPersistenceReady, store.isHydrating, store.cases.map((item) => item.id).join('|')],
  () => {
    void syncActiveCaseSelection();
  },
  { immediate: true },
);
watch(selectedId, async (id) => {
  if (!store.localPersistenceReady || !id) return;
  await store.setActiveAnesthesiaRecordScope(id);
  caseSheetReady.value = false;
  livePageNo.value = await restoreCasePageNo(id);
  restoreWorkflowState(id);
  store.syncRecordDocument(id);
  store.setRecordPageDraft(id, livePageNo.value);
  caseSheetReady.value = true;
});
watch(livePageNo, (page) => {
  if (!selectedId.value) return;
  store.setRecordPageDraft(selectedId.value, page);
  if (current.value) store.afterRecordMutation(selectedId.value);
});
watch(livePageCount, (count) => {
  if (livePageNo.value > count) livePageNo.value = Math.max(1, count);
});
watch(activeTab, () => saveDraft(false));
watch([primaryMethod, auxiliaryMethods, selectedTemplateName, pendingLandingItems, confirmedLandingItems, manualStage, selectedScenario, sectionVisibility], () => saveDraft(false), { deep: true });

const selectCase = (id: string) => {
  if (id === selectedId.value) return;
  const hint = store.prepareRecordScopeSwitch(id);
  const proceed = () => {
    selectedId.value = id;
    router.replace(buildRecordRoute(id, recordEntrySource.value));
  };
  if (hint.needConfirm) {
    Modal.confirm({
      title: '切换患者',
      content: hint.message ?? '确定切换患者？',
      onOk: proceed,
    });
    return;
  }
  proceed();
};

onMounted(async () => {
  await loadRecordPermissions();
  if (showE2eActions.value) {
    (window as Window & { __samisAnesthesiaE2E?: Record<string, unknown> }).__samisAnesthesiaE2E = {
      injectConflict: async (caseId = selectedId.value) => {
        await store.injectMockSyncConflict(caseId);
      },
      seedBoundaryVitals: (caseId = selectedId.value) => store.seedBoundaryVitalsForTest(caseId),
      saveUiSmokeCurrent: async (operationId: string): Promise<UiSmokeSyntheticResult> => {
        if (!canExposeUiSmokeHarness()) throw new Error('UI smoke harness requires explicit real integration opt-in');
        if (!UI_SMOKE_OPERATION_PREFIX.test(operationId)) {
          throw new Error('UI smoke operationId must start with OP-E2E-SCHEDULE- or OP-E2E-NATURAL-');
        }
        const index = store.cases.findIndex((item) => item.id === operationId);
        if (index < 0 || selectedId.value !== operationId || String(route.params.id || '') !== operationId) {
          throw new Error('UI smoke must save the schedule case selected through the real record route');
        }
        const synthetic = buildUiSmokeCase(store.cases[index]);
        store.cases[index] = synthetic;
        await persistCaseNow(synthetic, 1);
        await flushAnesthesiaSyncNow(operationId);
        const local = await inspectUiSmokeLocalState(operationId);
        return {
          operationId,
          recordLocalId: operationId,
          local,
        };
      },
      readUiSmokeLocalState: inspectUiSmokeLocalState,
      reloadUiSmokeFromServer: async (operationId: string): Promise<UiSmokeReloadResult> => {
        if (!canExposeUiSmokeHarness()) throw new Error('UI smoke harness requires explicit real integration opt-in');
        if (!UI_SMOKE_OPERATION_PREFIX.test(operationId)) {
          throw new Error('UI smoke operationId must start with OP-E2E-SCHEDULE- or OP-E2E-NATURAL-');
        }
        const reconstructed = await store.reloadCaseFromServer(operationId);
        return {
          operationId,
          record: Boolean(reconstructed),
          timelineEvents: reconstructed?.events?.length ?? 0,
          medications: reconstructed?.medications?.length ?? 0,
          vitalSigns: reconstructed?.vitals?.length ?? 0,
        };
      },
    };
  }
  await syncActiveCaseSelection();
  if (!selectedId.value) return;
  if (!caseSheetReady.value) {
    await prepareCurrentCaseView(selectedId.value);
  }
  const resumePrompt = store.checkMonitoringResumePrompt(selectedId.value);
  if (resumePrompt.show) {
    Modal.confirm({
      title: '恢复模拟采集',
      content: '检测到未结束的监护会话，已采集数据仍归属本记录单。是否恢复模拟采集？',
      okText: '恢复',
      cancelText: '暂不',
      onOk: () => {
        const result = store.resumeMonitoringMock(selectedId.value);
        if (result && !result.ok) Message.warning(result.message ?? '无法恢复模拟采集');
      },
      onCancel: () => store.dismissMonitoringResumePrompt(selectedId.value),
    });
  }
});
const onDeviceSimulationModeChange = (mode: DeviceSimulationMode) => {
  deviceSimulationMode.value = mode;
  if (!selectedId.value) return;
  store.setDeviceSimulationMode(selectedId.value, mode);
};
const onAbnormalSimulationTypesChange = (types: AbnormalSimulationType[]) => {
  abnormalSimulationTypes.value = types.length ? types : readAbnormalSimulationTypes();
  store.setAbnormalSimulationTypes(abnormalSimulationTypes.value);
  if (monitoringViewUi.value.mockTicking) {
    store.restartDeviceMocksForInterval(selectedId.value);
  }
};
const injectTestConflict = async () => {
  if (!selectedId.value) return;
  await store.injectMockSyncConflict(selectedId.value);
};
const stopAllDevices = () => {
  if (!monitoringViewUi.value.mockTicking && !monitoringViewUi.value.monitoringPaused) return;
  Modal.confirm({
    title: '停止监护',
    content: '确认停止监护仪和呼吸机模拟？已采集数据将保留。',
    onOk: () => {
      store.stopAllMonitoringDevices();
    },
  });
};
const toggleMonitorMock = () => {
  const ui = monitoringViewUi.value;
  if (ui.mockTicking && ui.hasMonitorSession) {
    store.stopMonitorDeviceMock();
    return;
  }
  if (ui.monitoringPaused && ui.hasMonitorSession) {
    const result = store.resumeMonitoringMock(selectedId.value);
    if (result && !result.ok) Message.warning(result.message ?? '无法恢复监护仪模拟');
    return;
  }
  const result = store.startMonitorDeviceMock(selectedId.value, monitorDisplayIntervalMinutes.value);
  if (result && !result.ok) Message.warning(result.message ?? '无法启动监护仪模拟');
};
const toggleVentilatorMock = () => {
  const ui = monitoringViewUi.value;
  if (ui.mockTicking && ui.hasVentilatorSession) {
    store.stopVentilatorDeviceMock();
    return;
  }
  if (ui.monitoringPaused && ui.hasVentilatorSession) {
    const result = store.resumeMonitoringMock(selectedId.value);
    if (result && !result.ok) Message.warning(result.message ?? '无法恢复呼吸机模拟');
    return;
  }
  const result = store.startVentilatorDeviceMock(selectedId.value, monitorDisplayIntervalMinutes.value);
  if (result && !result.ok) Message.warning(result.message ?? '无法启动呼吸机模拟');
};
const revokeMonitoring = (reason: string) => {
  Modal.confirm({
    title: '确认撤销监护',
    content: '撤销后，本次监护会话内的设备采集数据将标记作废，是否继续？',
    okText: '撤销',
    okButtonProps: { status: 'danger' },
    onOk: () => {
      const result = store.revokeMonitoringSession(selectedId.value, reason);
      if (!result.ok) Message.warning(result.message ?? '撤销失败');
      else Message.success('监护会话已撤销，相关设备数据已标记作废');
    },
  });
};
const goBackToSource = () => router.push(returnTarget.value.path);
const requireCurrent = (): SurgeryCase | undefined => current.value;
const patientRiskTags = (item: SurgeryCase) => {
  const tags: string[] = [];
  if (isRescueModeActive(item)) tags.push('抢救');
  if (!item.vitals.some((vital) => typeof vital.TEMP === 'number')) tags.push('缺体温');
  if (item.signatures?.status !== '已签名') tags.push('未签名');
  if (item.status === 'PACU' || item.transferTo === 'PACU') tags.push('PACU待转出');
  return tags;
};
const clampZoom = (value: number) => Math.min(1.2, Math.max(0.75, Number(value.toFixed(2))));
const increaseSheetZoom = () => { sheetZoom.value = clampZoom(sheetZoom.value + 0.05); };
const decreaseSheetZoom = () => { sheetZoom.value = clampZoom(sheetZoom.value - 0.05); };
const fitSheetWidth = () => { sheetZoom.value = 0.9; };
const startRecord = () => {
  if (!requireCurrent()) return;
  store.startAnesthesiaRecord(selectedId.value);
};
const handleRecordPrimaryAction = () => {
  if (recordActions.value.primaryAction === 'start') startRecord();
};
const importVitals = () => {
  store.importDeviceVitalsLayered(selectedId.value);
};
const applyRescuePageFocus = (pageNo?: number) => {
  if (pageNo && pageNo >= 1) {
    livePageNo.value = pageNo;
    store.setRecordPageDraft(selectedId.value, pageNo);
  }
};
const enterRescue = () => {
  const transition = store.enterRescueRecordMode(selectedId.value);
  if (transition.ok) {
    applyRescuePageFocus(transition.pageNo);
    Message.success('已进入抢救模式：1 分钟小格，已跳转抢救开始时间所在页');
    return;
  }
  if (current.value && isRescueModeActive(current.value)) Message.info('当前已在抢救模式中');
  else Message.warning('无法进入抢救模式');
};
const exitRescue = () => {
  const transition = store.exitRescueRecordMode(selectedId.value, '抢救结束，请补记相关记录');
  if (transition.ok) {
    applyRescuePageFocus(transition.pageNo);
    if (transition.deviceSimRestored) {
      deviceSimulationMode.value = 'normal';
    }
    const deviceHint = transition.deviceSimRestored
      ? '，设备模拟已恢复普通采集频率'
      : (readDeviceSimulationMode() === 'rescue' ? '；设备模拟仍为抢救频率，请在右侧切换为正常' : '');
    Message.success(`已退出抢救模式：5 分钟刻度，已跳转抢救结束时间所在页${deviceHint}`);
    return;
  }
  Message.warning('当前未处于抢救模式');
};
watch(rescueModeActive, (active, wasActive) => {
  if (wasActive && !active && current.value) {
    const pageNo = store.focusRecordPageByTime(
      selectedId.value,
      current.value.rescue?.endTime
        || current.value.device?.lastCollectTime
        || current.value.vitals[current.value.vitals.length - 1]?.time,
    );
    applyRescuePageFocus(pageNo);
    if (readDeviceSimulationMode() === 'normal') {
      deviceSimulationMode.value = 'normal';
    }
  }
});
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
    sectionVisibility: sectionVisibility.value,
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
const handleSectionVisibilityReason = (payload: { section: 'inhaled' | 'autologous'; visible: boolean; reason: string }) => {
  if (!current.value) return;
  const sectionLabel = payload.section === 'inhaled' ? '吸入麻醉' : '自体血';
  const message = `${sectionLabel}区块${payload.visible ? '显示' : '隐藏'}：${payload.reason}`;
  if (sectionReasonLogState.value[payload.section] === message) return;
  sectionReasonLogState.value = { ...sectionReasonLogState.value, [payload.section]: message };
  current.value.operationLogs = [message, ...(current.value.operationLogs ?? [])].slice(0, 8);
};
const addEvent = (type: string) => {
  if (!current.value) return;
  const option = getQuickEventOption(type);
  if (isQuickEventDone(current.value, option)) {
    Message.info(`${type} 已记录`);
    return;
  }
  const payload = buildQuickEventPayload(type, current.value, resolveRecordSheetNowIso(current.value));
  store.appendEvent(selectedId.value, payload);
  if (option.syncField && current.value) {
    current.value[option.syncField] = payload.time;
    if (option.syncField === 'roomInTime') {
      store.syncRecordDocument(selectedId.value);
      livePageNo.value = store.focusRecordPageByTime(selectedId.value, payload.time);
    }
  }
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
  const pageNo = store.applyTimelineNode(selectedId.value, node, isoTime);
  if (pageNo >= 1) livePageNo.value = pageNo;
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
const handleSheetEntry = (action: SheetEntryAction) => {
  if (!sheetQuickActions.value.entries.canEdit) {
    Message.warning('当前状态不可录入');
    return;
  }
  const sheet = liveSheetRef.value;
  if (!sheet) return;
  switch (action) {
    case 'medication':
      sheet.openMedicationEntry();
      break;
    case 'infusion':
      sheet.openInfusionEntry();
      break;
    case 'transfusion':
      sheet.openTransfusionEntry();
      break;
    case 'autologous':
      sheet.openTransfusionEntry();
      break;
    case 'vital':
      sheet.openVitalEntry();
      break;
    case 'output-urine':
      sheet.openOutputEntry('尿量');
      break;
    case 'output-blood':
      sheet.openOutputEntry('出血量');
      break;
    case 'output-drainage':
      sheet.openOutputEntry('引流量');
      break;
    case 'lab':
      sheet.openLabEntry();
      break;
    default:
      break;
  }
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
const openAbnormalGroupHandler = (group: AggregatedAbnormalVital) => {
  const target = abnormalVitals.value.find((item) => item.metric === group.metric && !item.handled);
  if (target) openAbnormalHandler(target);
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
const voidRecord = (kind: 'medication' | 'fluid' | 'vital' | 'output' | 'plane', id: string) => {
  if (!id) return;
  store.voidRecord(selectedId.value, kind, id);
  Message.success('已作废，可在「已录入数据维护」中撤销');
};
const restoreRecord = (kind: 'medication' | 'fluid' | 'vital' | 'output' | 'plane', id: string) => {
  if (!id) return;
  store.restoreRecord(selectedId.value, kind, id);
  Message.success('已撤销作废');
};
const selectSheetEvent = (event: Pick<AnesthesiaEvent, 'type'>) => {
  selectedEventName.value = event.type;
};
const qualityColor = (status: string) => status === '通过' ? 'green' : status === '警告' ? 'orange' : 'red';
</script>

<style scoped>
.anesthesia-record-workstation {
  --record-sheet-skeleton-height: 720px;
  --record-topbar-offset: 44px;
  --sheet-paper-offset: 0px;
  display: grid;
  gap: 8px;
  margin: -12px;
  padding: 8px 12px 12px;
}

.record-empty-page {
  display: grid;
  place-items: center;
  min-height: min(72vh, 560px);
  padding: 48px 24px;
}

.record-empty-page--loading {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
}

.record-empty-hint {
  margin: 0 0 16px;
  max-width: 420px;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.6;
  text-align: center;
}

.record-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr) 260px;
  gap: 10px;
  align-items: start;
}

.record-layout.queue-collapsed {
  grid-template-columns: minmax(0, 1fr) 260px;
}

.record-layout.quality-collapsed {
  grid-template-columns: 220px minmax(0, 1fr);
}

.record-layout.queue-collapsed.quality-collapsed {
  grid-template-columns: minmax(0, 1fr);
}

.sync-detail-modal {
  display: grid;
  gap: 8px;
}

.sync-error-text {
  color: var(--danger);
  font-size: 12px;
}

.work-mode-bar {
  display: none;
}

.sheet-hydration-shell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: var(--record-sheet-skeleton-height, 720px);
  height: var(--record-sheet-skeleton-height, 720px);
  color: var(--text-tertiary);
  background: var(--surface-muted);
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
}

.patient-queue {
  position: sticky;
  top: var(--record-topbar-offset);
  display: grid;
  gap: 10px;
  max-height: calc(100vh - var(--record-topbar-offset) - 24px);
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
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

.queue-filters {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.patient-card {
  display: grid;
  gap: 5px;
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: inherit;
  text-align: left;
}

.patient-card:hover,
.patient-card.active {
  border-color: var(--primary);
  background: var(--primary-soft);
}

.patient-card.active {
  box-shadow: inset 3px 0 0 var(--primary);
}

.patient-card.rescue {
  border-color: var(--color-danger-100);
  background: #fff7f7;
}

.patient-card div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.patient-card p {
  margin: 0;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  line-height: 1.35;
}

.patient-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.card-status {
  width: fit-content;
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--primary-soft);
  color: var(--primary);
  font-size: var(--font-size-xs);
}

.risk-tag {
  width: fit-content;
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--color-warning-100);
  color: var(--warning);
  font-size: var(--font-size-xs);
}

.record-center {
  min-width: 0;
  display: grid;
  gap: 12px;
}

.record-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 10px;
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
  padding: 6px 8px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-blue);
  box-shadow: var(--shadow-sm);
}

.sheet-zoom-frame {
  transform-origin: top left;
  zoom: var(--sheet-zoom);
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
  gap: 10px;
  align-content: start;
  padding-top: var(--sheet-paper-offset);
}

.record-toolbox {
  position: sticky;
  top: var(--record-topbar-offset);
  display: grid;
  gap: 8px;
  max-height: calc(100vh - var(--record-topbar-offset) - 16px);
  overflow: auto;
  padding: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.98);
}

.record-toolbox.collapsed {
  align-self: start;
  max-height: none;
}

.toolbox-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-secondary);
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
  top: var(--record-topbar-offset);
}

.record-audit-wrap {
  margin-top: 10px;
}

@media (max-width: 1280px) {
  .record-workspace {
    grid-template-columns: minmax(0, 1fr) 280px;
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
  margin: 4mm;
}

.anesthesia-record-workstation.print-preview-active > .record-workstation-topbar,
.anesthesia-record-workstation.print-preview-active > .record-layout,
.anesthesia-record-workstation.print-preview-active :deep(.record-workstation-topbar) {
  display: none;
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

  .anesthesia-record-workstation.print-preview-active > .record-layout,
  .anesthesia-record-workstation.print-preview-active :deep(.record-workstation-topbar) {
    display: none !important;
  }

  .app-sider,
  .app-header,
  .app-subnav,
  .record-workstation-topbar,
  .record-status-bar,
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

  .sheet-zoom-frame {
    zoom: 1 !important;
    transform: none !important;
  }

  .anesthesia-record-workstation.print-preview-active .sheet-workbench .live-record-card {
    display: none !important;
  }
}
</style>
