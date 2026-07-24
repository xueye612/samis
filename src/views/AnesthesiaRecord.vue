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
      @toggle-quality-panel="openReminders"
      @decrease-zoom="decreaseSheetZoom"
      @increase-zoom="increaseSheetZoom"
      @fit-width="fitSheetWidth"
      @select-case="selectCase"
      @open-sync-detail="syncDetailVisible = true"
      @open-conflicts="conflictPanelVisible = true"
    />

    <div v-if="rescueModeActive" class="rescue-banner no-print" role="status" aria-live="polite" data-testid="rescue-banner">
      <span class="rescue-dot" aria-hidden="true"></span>
      <strong>抢救中</strong>
      <span class="rescue-desc">1 分钟细线记录 · {{ currentStage }}</span>
      <a-button size="mini" status="warning" class="rescue-exit" data-testid="rescue-exit-btn" @click="exitRescue">退出抢救</a-button>
    </div>

    <div class="record-layout" :class="{ 'queue-collapsed': !patientPanelOpen }">
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
              <span>{{ item.gender }} · {{ safeAge(item.age) }}岁</span>
            </div>
            <p>{{ item.room }} · {{ item.department }}</p>
            <p>{{ item.surgeryName }}</p>
            <div class="patient-card-tags">
              <span class="card-status">{{ item.recordStatus ?? item.status }}</span>
              <span class="op-id-tail" :title="`operationId: ${item.id}`">#{{ String(item.id).slice(-6) }}</span>
              <span v-for="risk in patientRiskTags(item)" :key="risk" class="risk-tag">{{ risk }}</span>
            </div>
          </button>
        </div>
      </aside>

      <main class="record-center" :class="{ 'toolbox-collapsed': toolboxCollapsed }">
        <div class="record-workspace">
          <section ref="sheetWorkbenchRef" class="sheet-workbench">
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
                @header-dirty-change="onHeaderDirtyChange"
              />
            </div>
          </section>
        </div>

        <aside ref="toolboxRef" class="record-toolbox" :class="{ collapsed: toolboxCollapsed, 'drawer-open': toolboxDrawerVisible }">
            <div class="toolbox-head no-print">
              <button
                v-if="!toolboxCollapsed"
                type="button"
                class="toolbox-more-btn"
                data-testid="record-more-tools"
                @click="openMoreTools"
              >更多工具</button>
              <div class="toolbox-head-actions">
                <a-button size="mini" type="text" class="toolbox-drawer-close" @click="toolboxDrawerVisible = false">关闭</a-button>
                <a-button size="mini" type="text" @click="toolboxCollapsed = !toolboxCollapsed">
                  {{ toolboxCollapsed ? '展开' : '收起' }}
                </a-button>
              </div>
            </div>

            <!-- 折叠窄栏：仅保留图标入口，常驻 40~48px，真正释放侧栏宽度 -->
            <nav v-if="toolboxCollapsed" class="toolbox-rail no-print" data-testid="record-toolbox-rail">
              <button type="button" class="toolbox-rail-btn" :class="{ active: sideTab === 'task' }" title="当前任务" @click="sideTab = 'task'; toolboxCollapsed = false">任务</button>
              <button type="button" class="toolbox-rail-btn" :class="{ active: sideTab === 'device' }" title="设备" @click="sideTab = 'device'; toolboxCollapsed = false">
                设备
                <span v-if="deviceCount > 0" class="toolbox-rail-badge is-count">{{ deviceCount }}</span>
              </button>
              <button type="button" class="toolbox-rail-btn" :class="{ active: sideTab === 'reminder' }" title="提醒" @click="sideTab = 'reminder'; toolboxCollapsed = false">
                提醒
                <span v-if="reminderBadgeCount > 0" class="toolbox-rail-badge">{{ reminderBadgeCount }}</span>
              </button>
              <button type="button" class="toolbox-rail-btn" title="更多工具" @click="openMoreTools">⋯</button>
            </nav>

            <template v-if="!toolboxCollapsed">
            <div class="toolbox-tabs no-print" role="tablist">
              <button
                type="button"
                role="tab"
                class="toolbox-tab"
                :class="{ active: sideTab === 'task' }"
                data-testid="side-tab-task"
                @click="sideTab = 'task'"
              >当前任务</button>
              <button
                type="button"
                role="tab"
                class="toolbox-tab"
                :class="{ active: sideTab === 'device' }"
                data-testid="side-tab-device"
                @click="sideTab = 'device'"
              >设备<span v-if="deviceCount > 0" class="toolbox-tab-badge is-count">{{ deviceCount }}</span></button>
              <button
                type="button"
                role="tab"
                class="toolbox-tab"
                :class="{ active: sideTab === 'reminder' }"
                data-testid="side-tab-reminder"
                @click="sideTab = 'reminder'"
              >提醒<span v-if="reminderBadgeCount > 0" class="toolbox-tab-badge">{{ reminderBadgeCount }}</span></button>
            </div>
            <div class="toolbox-scroll-zone">
              <!-- 当前任务：手术场景/当前阶段 / 持续泵入 / 待确认记录 / 当前事件专业补充 / 最近录入 -->
              <div v-show="sideTab === 'task'" class="toolbox-tab-pane" data-testid="side-pane-task">
            <IntraopWorkflowPanel
              :stage="currentStage"
              :stage-options="scenarioContext.stageOptions"
              :scenario="selectedScenario"
              :scenario-options="scenarioContext.scenarioOptions"
              :recent-event-label="recentEventLabel"
              :pending-items="pendingLandingItems"
              :locked="current.locked"
              @update:stage="updateCurrentStage"
              @update:scenario="updateSurgeryScenario"
              @confirm-all="confirmAllLandingItems"
              @confirm-item="confirmLandingItem"
            />

            <!-- 关键时间：唯一主要录入与修改入口（复用 TimelineNodeRail 单数据源 saveTimelineNode）。 -->
            <a-card v-if="sheetMethodKeys.length" class="keytime-card" :bordered="false">
              <template #title>关键时间</template>
              <template #extra>
                <span class="keytime-progress">{{ timelineProgressLabel }}</span>
              </template>
              <TimelineNodeRail
                :embedded="false"
                :show-header="false"
                :record="current"
                :method-keys="sheetMethodKeys"
                :method-labels="sheetAppliedMethodLabels"
                :locked="current.locked"
                :can-revise="canReviseTimeline"
                :can-override="canOverrideTimelineOrder"
                :active-key="activeTimelineKey"
                @save="saveTimelineNode"
                @focus="focusWorkbenchTimelineNode"
              />
            </a-card>

            <section v-if="runningPumps.length" class="toolbox-pumps" data-testid="side-running-pumps">
              <header><strong>持续泵入</strong><span>{{ runningPumps.length }} 条</span></header>
              <div class="toolbox-pumps-list">
                <a-button
                  v-for="med in runningPumps"
                  :key="med.id"
                  size="mini"
                  status="warning"
                  :disabled="!canEditPumps"
                  @click="stopPump(med.id)"
                >停 {{ med.drug }}</a-button>
              </div>
            </section>

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
              </div>

              <!-- 设备：统一以设备采集会话为唯一来源 -->
              <div v-show="sideTab === 'device'" class="toolbox-tab-pane" data-testid="side-pane-device">
              <DeviceSessionVentilatorPanel :state="deviceSessionState" :display-paused="deviceDisplayPaused" @open-room-config="openMoreTools(); moreToolTab = 'roomDevice'" />
              <section class="device-ops no-print" data-testid="device-case-ops">
                <a-button v-if="deviceBound" size="mini" @click="openDeviceDetail">设备详情</a-button>
                <a-button v-if="deviceDisplayPaused" size="mini" type="primary" @click="deviceDisplayPaused = false">恢复显示</a-button>
                <a-button v-else size="mini" @click="deviceDisplayPaused = true">暂停显示</a-button>
                <a-button v-if="deviceSessionState.roomChanged" size="mini" status="warning" :loading="deviceOpLoading" @click="confirmDeviceTransfer">确认设备转移</a-button>
                <a-button v-if="deviceBound" size="mini" @click="refreshDeviceOpRooms(); deviceTransferForm = { targetRoomId: 0, reason: '' }; deviceTransferVisible = true">更换当前设备</a-button>
                <a-button v-if="deviceBound" size="mini" status="danger" @click="deviceStopReason = ''; deviceStopVisible = true">停止并解除关联</a-button>
              </section>
              <a-alert v-if="deviceDisplayPaused" type="info" class="device-paused-hint">显示已暂停，后台仍在采集；恢复后读取最新值（不修改 binding）。</a-alert>
              </div>

              <!-- 提醒：异常体征 / 待补字段 / 质控缺陷 / 完整性检查 / 设备异常 / 同步冲突 -->
              <div v-show="sideTab === 'reminder'" class="toolbox-tab-pane" data-testid="side-pane-reminder">
              <div class="reminder-summary" data-testid="reminder-breakdown">
                <strong>提醒 {{ reminderBadgeCount }}</strong>
                <span v-for="item in reminderBreakdown" :key="item.key" class="reminder-summary-tag">{{ item.label }} {{ item.count }}</span>
                <span v-if="!reminderBadgeCount" class="reminder-summary-empty">暂无未处理提醒</span>
              </div>
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
              <section v-if="deviceSessionAnomalies.length" class="reminder-block" data-testid="side-device-anomalies">
                <header><strong>设备异常</strong><span>{{ deviceSessionAnomalies.length }}项</span></header>
                <a-alert
                  v-for="(item, index) in deviceSessionAnomalies"
                  :key="index"
                  type="warning"
                  show-icon
                >{{ item }}</a-alert>
              </section>
              <section class="reminder-block reminder-links">
                <a-button v-if="(syncState.conflictCount ?? 0) > 0" long status="danger" @click="conflictPanelVisible = true">
                  同步冲突 {{ syncState.conflictCount }}
                </a-button>
                <a-button long @click="syncDetailVisible = true">同步详情</a-button>
              </section>
              </div>
            </div>
            </template>
          </aside>

        <button type="button" class="record-toolbox-fab no-print" data-testid="record-toolbox-fab" @click="toolboxDrawerVisible = true">
          记录辅助
        </button>
        <div v-if="toolboxDrawerVisible" class="record-toolbox-overlay no-print" data-testid="record-toolbox-overlay" @click="toolboxDrawerVisible = false" />
      </main>
    </div>

    <!-- 更多工具抽屉：收纳低频功能，复用现有组件，不新建第二套业务 -->
    <a-drawer
      v-model:visible="moreToolsVisible"
      :width="660"
      title="更多工具"
      placement="right"
      :footer="false"
      unmount-on-close
      class="no-print more-tools-drawer"
      popup-container-position="fixed"
    >
      <nav class="more-tools-nav no-print" data-testid="more-tools-nav">
        <button v-for="item in moreToolTabs" :key="item.key" type="button" class="more-tools-nav-btn" :class="{ active: moreToolTab === item.key }" @click="moreToolTab = item.key">{{ item.label }}</button>
      </nav>
      <div class="more-tools-scroll" data-testid="more-tools-body">
        <section v-show="moreToolTab === 'detail'" class="more-tools-section">
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
        </section>
        <section v-show="moreToolTab === 'structured'" class="more-tools-section">
          <StructuredClinicalEntitiesPanel
            :operation-id="current.id"
            :record-local-id="current.id"
            :read-only="current.locked || !canWriteStructuredRecord"
          />
        </section>
        <section v-show="moreToolTab === 'template'" class="more-tools-section">
          <AnesthesiaTemplateSelector compact :selected-template-name="selectedTemplateName" @apply="applyTemplate" />
        </section>
        <section v-show="moreToolTab === 'modules'" class="more-tools-section">
          <DynamicAnesthesiaModules
            compact
            :methods="selectedMethodKeys"
            :focus-module-keys="scenarioContext.focusModuleKeys"
            :field-values="current.professionalFieldValues"
            :read-only="current.locked"
            @save-field="saveProfessionalField"
          />
        </section>
        <section v-show="moreToolTab === 'audit'" class="more-tools-section">
          <RecordAuditPanel
            :logs="current.modificationLogs ?? []"
            :printed-at="current.printedAt"
            :locked="current.locked"
          />
        </section>
        <section v-show="moreToolTab === 'settings'" class="more-tools-section more-tools-links">
          <a-button long @click="conflictPanelVisible = true">同步冲突</a-button>
          <a-button long @click="syncDetailVisible = true">同步详情</a-button>
          <a-button long @click="sectionSettingsVisible = true">纸面显示设置</a-button>
        </section>
        <section v-show="moreToolTab === 'roomDevice'" class="more-tools-section">
          <RoomDeviceConfigPanel embedded @config-changed="() => { deviceSessionPoller?.refresh(); }" />
        </section>
      </div>
    </a-drawer>

    <!-- 设备详情 -->
    <a-modal v-model:visible="deviceDetailVisible" title="当前病例设备详情" :footer="false" :width="460" class="no-print">
      <div class="device-detail-grid">
        <div><span>当前手术间</span><strong>{{ deviceSessionState.binding?.roomName || deviceSessionState.bindingRoomName || current?.room || '—' }}</strong></div>
        <div><span>设备编号</span><strong>{{ deviceSessionState.binding?.deviceCode || '—' }}</strong></div>
        <div><span>设备型号</span><strong>{{ deviceDetailConfig?.deviceModel || '—' }}</strong></div>
        <div><span>中央采集编号</span><strong>{{ deviceDetailConfig?.centralDeviceNo || '—' }}</strong></div>
        <div><span>关联时间</span><strong>{{ deviceSessionState.binding?.effectiveFrom || '—' }}</strong></div>
        <div><span>关联方式</span><strong>{{ deviceSessionState.binding?.bindingMode || '—' }}</strong></div>
        <div><span>采集状态</span><strong>{{ deviceSessionState.ended ? '已停止' : (deviceSessionState.binding ? '采集中' : '未关联') }}</strong></div>
      </div>
    </a-modal>

    <!-- 更换当前设备（仅当前病例 binding，不改永久房间配置） -->
    <a-modal v-model:visible="deviceTransferVisible" title="更换当前病例设备" :on-before-ok="() => { doDeviceTransfer(); return false; }" ok-text="确认更换" :width="420" class="no-print">
      <p class="device-op-tip">仅更换当前病例 binding，不修改永久房间设备配置。</p>
      <div class="rdc-field" style="margin-bottom:10px">
        <span>目标手术间（取该房间 primary 设备）</span>
        <a-select v-model="deviceTransferForm.targetRoomId" popup-container="body" placeholder="选择手术间">
          <a-option v-for="r in deviceOpRooms" :key="r.roomId" :value="r.roomId">{{ r.roomName }}（{{ r.roomCode }}）</a-option>
        </a-select>
      </div>
      <div class="rdc-field">
        <span>更换原因（必填）</span>
        <a-input v-model="deviceTransferForm.reason" placeholder="如：设备故障临时更换" />
      </div>
    </a-modal>

    <!-- 停止并解除关联 -->
    <a-modal v-model:visible="deviceStopVisible" title="停止并解除关联" :on-before-ok="() => { doDeviceStop(); return false; }" ok-text="确认停止" :width="420" class="no-print">
      <p class="device-op-tip">将结束当前 binding，后端停止读取；不修改永久房间配置。重新开始时创建新 binding。</p>
      <div class="rdc-field">
        <span>停止原因（必填）</span>
        <a-input v-model="deviceStopReason" placeholder="如：设备拆除 / 采集结束" />
      </div>
    </a-modal>

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
import { anesthesiaDeviceSessionApi } from '@/api/anesthesiaDeviceSession';
import { anesthesiaRoomDeviceConfigApi } from '@/api/anesthesiaRoomDeviceConfig';
import { anesthesiaTimelineApi } from '@/api/anesthesiaTimeline';
import { initServerClock, isServerClockCalibrated } from '@/services/serverClock';
import { useRealAnesthesiaRecord, useRealAnesthesiaSync, useRealOperationInfo } from '@/config/apiFlags';
import dayjs from 'dayjs';
import { persistCaseNow, restoreCasePageNo } from '@/services/anesthesia/anesthesiaPersistenceBridge';
import { flushAnesthesiaSyncNow } from '@/services/anesthesia/anesthesiaSyncService';
import { getAnesthesiaLocalDb } from '@/services/anesthesia/localDb';
import { signRecordWithProvider } from '@/services/anesthesia/recordLifecycleClient';
import {
  clampMonitorDisplayIntervalMinutes,
  MONITOR_DISPLAY_INTERVAL_STORAGE_KEY,
  readMonitorDisplayIntervalMinutes,
  resolveMonitorDisplayIntervalMinutes,
} from '@/services/anesthesia/monitorMockService';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AnesthesiaTemplateApplyModal from '@/components/anesthesia/record/AnesthesiaTemplateApplyModal.vue';
import AnesthesiaTemplateSelector from '@/components/anesthesia/record/AnesthesiaTemplateSelector.vue';
import DynamicAnesthesiaModules from '@/components/anesthesia/record/DynamicAnesthesiaModules.vue';
import EventDetailPanel from '@/components/anesthesia/record/EventDetailPanel.vue';
import IntraopWorkflowPanel from '@/components/anesthesia/record/IntraopWorkflowPanel.vue';
import TimelineNodeRail from '@/components/anesthesia/record/TimelineNodeRail.vue';
import LiveAnesthesiaSheet from '@/components/anesthesia/record/LiveAnesthesiaSheet.vue';
import RecordDetailTabs from '@/components/anesthesia/record/RecordDetailTabs.vue';
import RecordRecentEntries from '@/components/anesthesia/record/RecordRecentEntries.vue';
import RecordQualityPanel from '@/components/anesthesia/record/RecordQualityPanel.vue';
import RoomDeviceConfigPanel from '@/components/anesthesia/record/RoomDeviceConfigPanel.vue';
import StructuredClinicalEntitiesPanel from '@/components/anesthesia/record/StructuredClinicalEntitiesPanel.vue';
import RecordWorkstationTopbar from '@/components/anesthesia/record/RecordWorkstationTopbar.vue';
import RecordSheetQuickStrip from '@/components/anesthesia/record/RecordSheetQuickStrip.vue';
import { buildRecordActionVisibility, buildRecordEntryVisibility } from '@/services/anesthesia/recordActionRules';
import { resolveQuickEventTimelineNode, resolveSheetQuickEvents, type SheetEntryAction } from '@/services/anesthesia/recordQuickActions';
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
  readDeviceRawIntervalSeconds,
  readDeviceSimulationMode,
  writeDeviceRawIntervalSeconds,
  type AbnormalSimulationType,
  type DeviceSimulationMode,
} from '@/services/anesthesia/deviceSimulationMode';
import {
  getMonitoringRegistry,
  resolveMonitoringViewUi,
} from '@/services/anesthesia/monitoringSessionService';
import {
  createRealtimeDevicePoller,
  emptyRealtimeDeviceState,
  normalizeLatestDeviceData,
  resolveDeviceFreshness,
  type RealtimeDevicePoller,
} from '@/services/anesthesia/realtimeDeviceData';
import {
  loadDeviceRealtimeSource,
  loadLatestSimulatedDeviceData,
  readCachedDeviceRealtimeSource,
  shouldAutoStartMonitorOnRecordStart,
  subscribeSimulatedDeviceDataCollected,
  type DeviceRealtimeSource,
} from '@/services/anesthesia/deviceRealtimeSource';
import {
  createDeviceSessionPoller,
  emptyDeviceSessionState,
  type DeviceSessionPoller,
  type DeviceSessionState,
} from '@/services/anesthesia/deviceSessionPoller';
import { createDeviceFormalPointPoller, type DeviceFormalPointPoller } from '@/services/anesthesia/deviceFormalPointPoller';
import { useBackendDeviceFormalPoints } from '@/config/apiFlags';
import DeviceSessionVentilatorPanel from '@/components/anesthesia/record/DeviceSessionVentilatorPanel.vue';
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
import { sortCasesByClinicalPriority, dedupeCasesByOperationId } from '@/services/scheduleHelpers';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import { anesthesiaMethodOptions } from '@/mock/anesthesiaRecordPrototype';
import type { AnesthesiaMethodKey, TemplateLandingItem, TemplateQualityTip } from '@/mock/anesthesiaRecordPrototype';
import type { MethodTimelineNode } from '@/services/methodTimelineEngine';
import { buildTimelineNodeStates, getMethodTimelineNodes, resolveTimelineNodeTime, validateTimelineNodeTime, formatTimelineClock } from '@/services/methodTimelineEngine';
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
const deviceRawIntervalSeconds = ref(readDeviceRawIntervalSeconds());
const deviceSimulationMode = ref<DeviceSimulationMode>(readDeviceSimulationMode());
const abnormalSimulationTypes = ref<AbnormalSimulationType[]>(readAbnormalSimulationTypes());
const showE2eActions = computed(() => import.meta.env.DEV || (typeof localStorage !== 'undefined' && localStorage.getItem('samis.e2e') === '1'));
const showDevConflictButton = computed(() => import.meta.env.DEV && ANESTHESIA_USE_MOCK);
const recordPermissions = ref<string[]>([]);
const canWriteStructuredRecord = computed(() => recordPermissions.value.some((code) => code === '*' || code === 'record.*' || code === 'record.write'));
// 关键时间权限：修改/清除需 record.revise；异常顺序覆盖需 record.timeline.override。
const canReviseTimeline = computed(() => recordPermissions.value.some((code) => code === '*' || code === 'record.*' || code === 'record.revise'));
const canOverrideTimelineOrder = computed(() => recordPermissions.value.some((code) => code === '*' || code === 'record.*' || code === 'record.revise' || code === 'record.timeline.override'));
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
const deviceRawIntervalOptions = [2, 5, 10, 15, 30].map((value) => ({ label: `${value} 秒/次`, value }));
watch(monitorDisplayIntervalMinutes, (value) => {
  const minutes = clampMonitorDisplayIntervalMinutes(value);
  monitorDisplayIntervalMinutes.value = minutes;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(MONITOR_DISPLAY_INTERVAL_STORAGE_KEY, String(minutes));
  }
});
const updateDeviceRawIntervalSeconds = (value: number) => {
  deviceRawIntervalSeconds.value = writeDeviceRawIntervalSeconds(value);
  if (selectedId.value && monitoringViewUi.value.mockTicking) {
    store.restartDeviceMocksForInterval(selectedId.value);
  }
};
const updateMonitorDisplayIntervalMinutes = (value: number) => {
  monitorDisplayIntervalMinutes.value = clampMonitorDisplayIntervalMinutes(value);
  if (selectedId.value && monitoringViewUi.value.mockTicking) {
    store.restartDeviceMocksForInterval(selectedId.value);
  }
};
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
const deviceRealtimeSource = ref<DeviceRealtimeSource>(readCachedDeviceRealtimeSource());
const deviceRealtimeSourceReady = ref(false);
const realtimeDeviceState = ref(emptyRealtimeDeviceState(selectedId.value));
let realtimeDevicePoller: RealtimeDevicePoller | null = null;
let unsubscribeSimulatedDeviceData: (() => void) | null = null;
let simulatedRealtimeRefreshTimer: ReturnType<typeof setInterval> | null = null;

// 后端设备采集会话（呼吸机预览，统一契约，cursor 增量轮询）。
const deviceSessionState = ref<DeviceSessionState>(emptyDeviceSessionState(selectedId.value));
let deviceSessionPoller: DeviceSessionPoller | null = null;
// 后端正式落点轮询（普通5分钟/抢救1分钟），生成正式生命体征，取代前端模拟每分钟写入。
let deviceFormalPointPoller: DeviceFormalPointPoller | null = null;
const stopDeviceSessionPolling = () => {
  deviceSessionPoller?.stop();
  deviceSessionPoller = null;
  deviceFormalPointPoller?.stop();
  deviceFormalPointPoller = null;
};
// 设备标签病例操作：暂停显示（仅前端，后端继续采集）/ 设备详情 / 更换当前设备 / 停止解除关联。
const deviceDisplayPaused = ref(false);
const deviceDetailVisible = ref(false);
const deviceDetailConfig = ref<{ centralDeviceNo: string; deviceModel: string } | null>(null);
const openDeviceDetail = async () => {
  deviceDetailVisible.value = true;
  deviceDetailConfig.value = null;
  try {
    const res = await anesthesiaRoomDeviceConfigApi.list();
    const room = res.list.find((r) => r.roomCode === current.value?.room);
    const primary = room?.primaryDevice;
    if (primary) deviceDetailConfig.value = { centralDeviceNo: primary.centralDeviceNo, deviceModel: primary.deviceModel };
  } catch { /* 房间配置未取到时不阻塞详情 */ }
};
const deviceTransferVisible = ref(false);
const deviceStopVisible = ref(false);
const deviceOpRooms = ref<Array<{ roomId: number; roomName: string; roomCode: string }>>([]);
const deviceTransferForm = ref({ targetRoomId: 0, reason: '' });
const deviceStopReason = ref('');
const deviceOpLoading = ref(false);
const deviceBound = computed(() => Boolean(deviceSessionState.value.binding));
const deviceCurrentRoomId = computed(() => {
  const code = current.value?.room;
  const hit = deviceOpRooms.value.find((r) => r.roomCode === code);
  return hit?.roomId ?? 0;
});
const refreshDeviceOpRooms = async () => {
  try {
    const res = await anesthesiaRoomDeviceConfigApi.list();
    deviceOpRooms.value = res.list.map((r) => ({ roomId: r.roomId, roomName: r.roomName, roomCode: r.roomCode }));
  } catch { deviceOpRooms.value = []; }
};
const confirmDeviceTransfer = async () => {
  if (!current.value || deviceCurrentRoomId.value <= 0) return;
  deviceOpLoading.value = true;
  try {
    await anesthesiaDeviceSessionApi.transfer({ operationId: current.value.id, targetRoomId: deviceCurrentRoomId.value, reason: '确认手术间设备转移' });
    Message.success('已转移至当前手术间设备');
    deviceSessionPoller?.refresh();
  } catch (e) { Message.error((e as Error)?.message ?? '转移失败'); }
  finally { deviceOpLoading.value = false; }
};
const doDeviceTransfer = async () => {
  if (!current.value || deviceTransferForm.value.targetRoomId <= 0 || !deviceTransferForm.value.reason.trim()) {
    Message.warning('请选择目标手术间并填写原因'); return;
  }
  deviceOpLoading.value = true;
  try {
    await anesthesiaDeviceSessionApi.transfer({ operationId: current.value.id, targetRoomId: deviceTransferForm.value.targetRoomId, reason: deviceTransferForm.value.reason });
    Message.success('已更换当前病例设备（不影响永久房间配置）');
    deviceTransferVisible.value = false;
    deviceTransferForm.value = { targetRoomId: 0, reason: '' };
    deviceSessionPoller?.refresh();
  } catch (e) { Message.error((e as Error)?.message ?? '更换失败'); }
  finally { deviceOpLoading.value = false; }
};
const doDeviceStop = async () => {
  const bindingId = deviceSessionState.value.binding?.bindingId;
  if (!bindingId || !deviceStopReason.value.trim()) { Message.warning('请填写停止原因'); return; }
  deviceOpLoading.value = true;
  try {
    await anesthesiaDeviceSessionApi.cancel({ bindingId, reason: deviceStopReason.value });
    Message.success('已停止并解除当前病例设备关联');
    deviceStopVisible.value = false;
    deviceStopReason.value = '';
    deviceSessionPoller?.refresh();
  } catch (e) { Message.error((e as Error)?.message ?? '停止失败'); }
  finally { deviceOpLoading.value = false; }
};
const restartDeviceSessionPolling = (operationId: string) => {
  stopDeviceSessionPolling();
  // 切换病例：清除旧 cursor 与 items，不复用旧 binding。
  deviceSessionState.value = emptyDeviceSessionState(operationId);
  if (!operationId) return;
  deviceSessionPoller = createDeviceSessionPoller({
    operationId,
    onState: (state) => { deviceSessionState.value = state; },
  });
  deviceSessionPoller.start();
  // 正式落点：启用后端设备查询时，按当前抢救态轮询 queryRecordPoint 生成正式代表点。
  if (useBackendDeviceFormalPoints()) {
    deviceFormalPointPoller = createDeviceFormalPointPoller({
      operationId: () => selectedId.value,
      rescueActive: () => rescueModeActive.value,
      onFormalPoint: () => { void store.reloadCaseFromServer(operationId); },
    });
    deviceFormalPointPoller.start();
  }
};
const stopRealtimeDevicePolling = () => {
  realtimeDevicePoller?.stop();
  realtimeDevicePoller = null;
};
const restartRealtimeDevicePolling = (operationId: string) => {
  stopRealtimeDevicePolling();
  realtimeDeviceState.value = emptyRealtimeDeviceState(operationId);
  if (!operationId || !deviceRealtimeSourceReady.value) return;
  realtimeDevicePoller = createRealtimeDevicePoller({
    operationId,
    ...(deviceRealtimeSource.value === 'simulation' ? { load: loadLatestSimulatedDeviceData } : {}),
    onState: (state) => { realtimeDeviceState.value = state; },
  });
  realtimeDevicePoller.start();
};
const refreshSimulatedRealtimeDeviceState = async (operationId: string) => {
  const data = normalizeLatestDeviceData(await loadLatestSimulatedDeviceData(operationId));
  if (operationId !== selectedId.value || deviceRealtimeSource.value !== 'simulation') return;
  realtimeDeviceState.value = {
    operationId,
    data,
    freshness: resolveDeviceFreshness(data),
    loading: false,
    error: null,
    polledAt: new Date().toISOString(),
  };
};
const activeTab = ref(String((store.recordDrafts[selectedId.value] as { selectedTab?: string } | undefined)?.selectedTab ?? 'patient'));
const keyword = ref('');
const queueRoomFilter = ref('');
const queueStatusFilter = ref('');
const queueRiskFilter = ref('');
const qualityVisible = ref(false);
const patientPanelOpen = ref(false);
const qualityPanelOpen = ref(false);
const toolboxCollapsed = ref(false);
const toolboxDrawerVisible = ref(false);
// 右侧三标签侧栏：默认打开“当前任务”；低频功能收纳进“更多工具”抽屉。
const sideTab = ref<'task' | 'device' | 'reminder'>('task');
const moreToolsVisible = ref(false);
// 更多工具一级导航：每个低频工具独立一页，不再纵向堆叠成超长页面。
const moreToolTab = ref<'detail' | 'structured' | 'template' | 'modules' | 'audit' | 'settings' | 'roomDevice'>('detail');
const moreToolTabs = [
  { key: 'detail' as const, label: '数据明细' },
  { key: 'structured' as const, label: '结构化记录' },
  { key: 'template' as const, label: '麻醉方案模板' },
  { key: 'modules' as const, label: '专业字段' },
  { key: 'audit' as const, label: '日志与审计' },
  { key: 'settings' as const, label: '纸面设置' },
  { key: 'roomDevice' as const, label: '手术间设备配置' },
];
// 打开“更多工具”抽屉：小屏下先关闭右侧侧栏抽屉，避免出现嵌套抽屉。
const openMoreTools = () => {
  toolboxDrawerVisible.value = false;
  moreToolsVisible.value = true;
};
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
// 纸面适宽：以 A4 横向内容设计宽度为基准，根据 sheet-workbench 实际可用宽度动态计算缩放。
// 用户手动缩放后置 userZoomed，ResizeObserver 仅在非手动态生效，避免反复重置手动缩放。
const SHEET_DESIGN_WIDTH = 1120;
const sheetWorkbenchRef = ref<HTMLElement | null>(null);
const sheetWorkbenchWidth = ref(0);
const userZoomed = ref(false);
const manualSheetZoom = ref(1);
let sheetWorkbenchObserver: ResizeObserver | null = null;
// 适宽自动缩放下限提高到 0.85：避免在窄屏把关键临床文字缩到不可读；
// 宽度仍不足时由 .sheet-workbench 自身的横向滚动承载，不再一味压缩字号。
const fitClamp = (value: number) => Math.min(1, Math.max(0.85, Number(value.toFixed(2))));
const autoFitZoom = computed(() => {
  const available = sheetWorkbenchWidth.value;
  if (!available) return 1;
  return fitClamp(available / SHEET_DESIGN_WIDTH);
});
const sheetZoom = computed(() => (userZoomed.value ? manualSheetZoom.value : autoFitZoom.value));
const syncSheetWorkbenchWidth = () => {
  const el = sheetWorkbenchRef.value;
  if (el) sheetWorkbenchWidth.value = el.clientWidth;
};
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

// 病例列表：先按 operationId 去重（防止远端/本地合并或轮询追加导致重复选项），再按临床优先级排序。
const sortedCases = computed(() => sortCasesByClinicalPriority(dedupeCasesByOperationId(store.cases)));
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

// 展示层兜底：非法年龄（NaN/空/非数字）显示为 “—”，避免患者卡片出现 “NaN岁”。
const safeAge = (value: unknown): string => {
  if (value === undefined || value === null) return '—';
  const text = String(value).trim();
  if (!text || ['nan', 'null', 'undefined'].includes(text.toLowerCase())) return '—';
  const num = Number(text);
  if (Number.isNaN(num) || !Number.isFinite(num) || num < 0) return '—';
  return text;
};

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
const monitoringViewUi = computed(() => {
  // 监护会话注册表是模块级运行态；同步状态变化作为响应式版本信号，
  // 确保启动、暂停、恢复和停止后立即重新投影视图。
  void store.monitoringSessionRevision;
  void syncState.value.monitorRunning;
  void syncState.value.ventilatorRunning;
  return resolveMonitoringViewUi(selectedId.value, getMonitoringRegistry());
});
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
// 持续泵入项目（当前任务标签内提供停止操作，与顶部快捷条不重复主入口）。
const runningPumps = computed(() => current.value?.medications.filter(
  (item) => item.mode === '持续泵入' && !item.stopTime,
) ?? []);
// 设备数量角标：表示实际已关联的设备数量（不混入异常计数）。
const deviceCount = computed(() => (deviceSessionState.value.binding ? 1 : 0));
// 设备异常（提醒标签）：仅以设备采集会话为唯一来源，已恢复的不计入。
const deviceSessionAnomalies = computed<string[]>(() => {
  const list: string[] = [];
  if (deviceSessionState.value.roomChanged) {
    list.push(`手术间已变化，请确认设备转移（${deviceSessionState.value.bindingRoomName || deviceSessionState.value.bindingRoomCode || '—'} → ${deviceSessionState.value.currentRoomName || deviceSessionState.value.currentRoomCode || '—'}）`);
  }
  if (deviceSessionState.value.error && !deviceSessionState.value.ended) {
    list.push(deviceSessionState.value.error);
  }
  return list;
});
// 提醒标签：按稳定 issueId 去重的统一问题列表，避免完整性检查与各来源重复计数。
interface ReminderIssue { id: string; label: string; category: 'pending' | 'defect' | 'abnormal' | 'device' | 'conflict' }
const reminderIssues = computed<ReminderIssue[]>(() => {
  if (!current.value) return [];
  const issues: ReminderIssue[] = [];
  recordPendingFields.value.forEach((f) => issues.push({ id: `pending:${f.key}`, label: f.label, category: 'pending' }));
  caseDefects.value.forEach((d) => issues.push({ id: `defect:${d.defectId}`, label: d.defectType, category: 'defect' }));
  panelAbnormalVitals.value.forEach((a) => issues.push({ id: `abnormal:${a.id}`, label: a.summary, category: 'abnormal' }));
  deviceSessionAnomalies.value.forEach((msg, i) => issues.push({ id: `device:${i}:${msg.slice(0, 12)}`, label: msg, category: 'device' }));
  const conflictCount = syncState.value.conflictCount ?? 0;
  for (let i = 0; i < conflictCount; i += 1) issues.push({ id: `conflict:${i}`, label: '同步冲突', category: 'conflict' });
  // 稳定 id 去重
  const seen = new Set<string>();
  return issues.filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)));
});
const reminderBadgeCount = computed(() => reminderIssues.value.length);
const reminderBreakdown = computed(() => {
  const map: Record<string, number> = { pending: 0, defect: 0, abnormal: 0, device: 0, conflict: 0 };
  reminderIssues.value.forEach((it) => { map[it.category] += 1; });
  return [
    { key: 'pending', label: '待完善', count: map.pending },
    { key: 'defect', label: '质控缺陷', count: map.defect },
    { key: 'abnormal', label: '异常体征', count: map.abnormal },
    { key: 'device', label: '设备异常', count: map.device },
    { key: 'conflict', label: '同步冲突', count: map.conflict },
  ].filter((it) => it.count > 0);
});
const canEditPumps = computed(() => sheetQuickActions.value.entries.canEdit);
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
    // 通知单（HULI 通知）已删除/归档/暂时查不到时，不应阻止打开已有麻醉记录：
    // 先尝试通知单主数据，失败则回退到 anes_record（getRecordDetail）。
    let loaded: SurgeryCase | null = null;
    try {
      loaded = await store.loadOperationCaseById(routeId);
    } catch {
      loaded = null;
    }
    if (!loaded) {
      loaded = await store.reloadCaseFromServer(routeId);
    }
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
  restartRealtimeDevicePolling(id);
  restartDeviceSessionPolling(id);
  if (!store.localPersistenceReady || !id) return;
  await store.setActiveAnesthesiaRecordScope(id);
  caseSheetReady.value = false;
  livePageNo.value = await restoreCasePageNo(id);
  restoreWorkflowState(id);
  store.syncRecordDocument(id);
  store.setRecordPageDraft(id, livePageNo.value);
  // 纸面由骨架切换为正式内容前先冻结当前可用宽度，避免首屏渲染后 ResizeObserver 再改缩放造成闪动。
  syncSheetWorkbenchWidth();
  caseSheetReady.value = true;
}, { immediate: true });
watch(
  () => current.value?.vitals.length ?? 0,
  () => {
    if (deviceRealtimeSourceReady.value && deviceRealtimeSource.value === 'simulation') void realtimeDevicePoller?.refresh();
  },
);
watch(
  () => syncState.value.lastCollectTime,
  (value, previous) => {
    if (!value || value === previous) return;
    if (deviceRealtimeSourceReady.value && deviceRealtimeSource.value === 'simulation') {
      void realtimeDevicePoller?.refresh();
    }
  },
);
watch(
  () => store.simulatedRealtimeDeviceData[selectedId.value],
  (raw) => {
    if (!raw || deviceRealtimeSource.value !== 'simulation') return;
    const data = normalizeLatestDeviceData(raw);
    realtimeDeviceState.value = {
      operationId: selectedId.value,
      data,
      freshness: resolveDeviceFreshness(data),
      loading: false,
      error: null,
      polledAt: new Date().toISOString(),
    };
  },
  { deep: true },
);
onBeforeUnmount(stopRealtimeDevicePolling);
onBeforeUnmount(stopDeviceSessionPolling);
onBeforeUnmount(() => {
  unsubscribeSimulatedDeviceData?.();
  unsubscribeSimulatedDeviceData = null;
  if (simulatedRealtimeRefreshTimer) clearInterval(simulatedRealtimeRefreshTimer);
  simulatedRealtimeRefreshTimer = null;
});
onBeforeUnmount(() => {
  sheetWorkbenchObserver?.disconnect();
  sheetWorkbenchObserver = null;
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

// 患者表头折叠编辑草稿脏状态：切换患者前确认，避免丢失未保存修改。
const headerDirty = ref(false);
const onHeaderDirtyChange = (dirty: boolean) => { headerDirty.value = dirty; };

// 顶栏“质控/提醒”入口统一收敛到右侧“提醒”标签，不再保留独立质控侧栏。
const openReminders = () => {
  const willOpen = sideTab.value !== 'reminder' || toolboxCollapsed.value || !qualityPanelOpen.value;
  sideTab.value = 'reminder';
  qualityPanelOpen.value = willOpen;
  if (willOpen) toolboxCollapsed.value = false;
};

const selectCase = (id: string) => {
  if (id === selectedId.value) return;
  const hint = store.prepareRecordScopeSwitch(id);
  const proceed = () => {
    headerDirty.value = false;
    selectedId.value = id;
    router.replace(buildRecordRoute(id, recordEntrySource.value));
  };
  const runConfirm = (message: string) => {
    Modal.confirm({
      title: '切换患者',
      content: message,
      onOk: proceed,
    });
  };
  // 患者表头存在未保存草稿时，切换患者必须确认，避免丢失编辑。
  if (headerDirty.value) {
    runConfirm('当前患者信息有未保存修改，切换后将丢弃，是否继续？');
    return;
  }
  if (hint.needConfirm) {
    runConfirm(hint.message ?? '确定切换患者？');
    return;
  }
  proceed();
};

onMounted(async () => {
  // 独立获取服务器时间（不依赖设备 binding），用于关键时间默认"现在"。
  void initServerClock(() => anesthesiaTimelineApi.getServerNow());
  // 纸面适宽：观测 sheet-workbench 可用宽度，仅在非手动缩放态驱动 autoFitZoom
  await nextTick();
  if (sheetWorkbenchRef.value && typeof ResizeObserver !== 'undefined') {
    syncSheetWorkbenchWidth();
    sheetWorkbenchObserver = new ResizeObserver(() => syncSheetWorkbenchWidth());
    sheetWorkbenchObserver.observe(sheetWorkbenchRef.value);
  }
  const configuredDeviceSource = await loadDeviceRealtimeSource();
  deviceRealtimeSource.value = configuredDeviceSource;
  deviceRealtimeSourceReady.value = true;
  restartRealtimeDevicePolling(selectedId.value);
  unsubscribeSimulatedDeviceData = subscribeSimulatedDeviceDataCollected((operationId) => {
    if (operationId !== selectedId.value || deviceRealtimeSource.value !== 'simulation') return;
    void refreshSimulatedRealtimeDeviceState(operationId).catch(() => {
      void realtimeDevicePoller?.refresh();
    });
  });
  if (configuredDeviceSource === 'simulation') {
    simulatedRealtimeRefreshTimer = setInterval(() => {
      if (!selectedId.value) return;
      void refreshSimulatedRealtimeDeviceState(selectedId.value).catch(() => undefined);
    }, 1_000);
  }
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
const pauseAllDevices = () => {
  const result = store.pauseAllMonitoringDevices();
  if (!result.ok) Message.warning(result.message ?? '无法暂停设备模拟');
  else void realtimeDevicePoller?.refresh();
};
const resumeAllDevices = () => {
  const result = store.resumeMonitoringMock(selectedId.value);
  if (!result.ok) Message.warning(result.message ?? '无法继续采集');
  else void realtimeDevicePoller?.refresh();
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
const clampZoom = (value: number) => Math.min(1.2, Math.max(0.85, Number(value.toFixed(2))));
const increaseSheetZoom = () => { userZoomed.value = true; manualSheetZoom.value = clampZoom(sheetZoom.value + 0.05); };
const decreaseSheetZoom = () => { userZoomed.value = true; manualSheetZoom.value = clampZoom(sheetZoom.value - 0.05); };
const fitSheetWidth = () => { userZoomed.value = false; syncSheetWorkbenchWidth(); };
const startRecord = () => {
  if (!requireCurrent()) return;
  const result = store.startAnesthesiaRecord(selectedId.value);
  if (!result.ok) {
    Message.warning(result.message);
    return;
  }
  if (shouldAutoStartMonitorOnRecordStart(deviceRealtimeSource.value, deviceRealtimeSourceReady.value)) {
    const monitorResult = store.startMonitorDeviceMock(selectedId.value, monitorDisplayIntervalMinutes.value);
    if (!monitorResult.ok) {
      Message.warning(`记录已启动，但模拟监护仪启动失败：${monitorResult.message ?? '请手动重试'}`);
      return;
    }
    void refreshSimulatedRealtimeDeviceState(selectedId.value).catch(() => undefined);
    Message.success('记录已启动，模拟监护仪已开始采集');
    return;
  }
  Message.success('记录已启动，等待真实监护仪连接');
};
const handleRecordPrimaryAction = () => {
  if (recordActions.value.primaryAction === 'start') startRecord();
  if (recordActions.value.primaryAction === 'end') {
    Modal.confirm({
      title: '结束麻醉记录',
      content: '结束后记录单进入待签名状态，不会替代“麻醉结束”临床事件。请确认设备采集已经停止，是否继续？',
      okText: '结束记录',
      okButtonProps: { status: 'danger' },
      onOk: async () => {
        const result = await store.endAnesthesiaRecord(
          selectedId.value,
          current.value ? resolveRecordSheetNowIso(current.value) : undefined,
        );
        if (!result.ok) {
          Message.warning(result.message);
          return;
        }
        Message.success('麻醉记录已结束，等待签名');
      },
    });
  }
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
const submitSignature = async () => {
  store.syncDataset();
  if (!current.value || current.value.recordStatus !== '待签名') {
    Message.warning('请先结束记录并生成待签名冻结版本');
    return;
  }
  if (qualityChecks.value.some((item) => item.status === '未通过')) {
    runQuality();
    return;
  }
  const signatures = current.value.signatures;
  if (!signatures?.providerSignatureId) {
    Message.warning('第三方电子签名服务尚未配置，记录保持待签名');
    return;
  }
  if (!signatures.revisionId || !signatures.serverSyncVersion) {
    Message.warning('待签名冻结版本不完整，请重新读取记录');
    return;
  }

  const signedAt = dayjs().toISOString();
  const signedSignatures = {
    ...signatures,
    anesthesiologist: current.value.anesthesiologist,
    nurse: current.value.anesthesiaNurse,
    surgeon: current.value.surgeon,
    signedAt,
    status: '已签名' as const,
  };
  const signedCase = {
    ...current.value,
    signatures: signedSignatures,
    recordStatus: '已锁定' as const,
    locked: true,
  };
  const result = await signRecordWithProvider(selectedId.value, {
    revisionId: signatures.revisionId,
    providerSignatureId: signatures.providerSignatureId,
    expectedSyncVersion: signatures.serverSyncVersion,
    casePayload: signedCase,
  });
  if (!result.ok) {
    Message.warning(result.message);
    return;
  }
  current.value.signatures = { ...signedSignatures, serverSyncVersion: result.syncVersion, signedAt: result.signedAt ?? signedAt };
  current.value.recordStatus = '已锁定';
  current.value.locked = true;
  store.syncDataset();
  Message.success('第三方电子签名验证通过，记录单已锁定');
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
  const timelineNode = resolveQuickEventTimelineNode(type, sheetMethodKeys.value);
  if (timelineNode) {
    saveTimelineNode(timelineNode, payload.time, { source: '快捷事件' });
    return;
  }
  store.appendEvent(selectedId.value, payload);
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
  fastingStatus?: NonNullable<SurgeryCase['preVisit']['fastingStatus']>;
  preMedications?: string;
  preoperativeConditions?: string;
  surgeryType?: NonNullable<SurgeryCase['surgeryType']>;
  surgeryLevel?: NonNullable<SurgeryCase['surgeryLevel']>;
  postoperativeDiagnosis?: string;
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
// 关键时间后端版本号（乐观锁）。
const timelineSyncVersion = ref(0);
// 关键时间统一提交：先调后端 saveTimelineNode（权限+审计+原始保护），成功后用返回值更新 Store。
const commitTimelineNode = async (node: MethodTimelineNode, isoTime: string, opts: { reason?: string; previousTime?: string; source?: string; overrideOrder?: boolean; clear?: boolean }) => {
  const record = current.value;
  if (!record) return;
  try {
    const result = await anesthesiaTimelineApi.saveTimelineNode({
      operationId: record.id,
      nodeCode: node.key,
      nodeName: node.label,
      newTime: opts.clear ? null : isoTime,
      reason: opts.reason,
      timelineOrderOverride: opts.overrideOrder === true,
      source: opts.source,
      expectedVersion: timelineSyncVersion.value,
    });
    // 后端保存成功：用返回值更新 Store（IndexedDB 仅缓存，后端为真值）。
    timelineSyncVersion.value = result.syncVersion;
    const appliedTime = opts.clear ? '' : (result.eventTime ?? isoTime);
    const pageNo = store.applyTimelineNode(selectedId.value, node, appliedTime, opts);
    if (pageNo >= 1) livePageNo.value = pageNo;
    activeTimelineKey.value = node.key;
    if (opts.clear) {
      recentEventLabel.value = `清除 ${node.label}`;
      pushRecentEntry({ kind: 'timeline', label: `清除${node.label}`, time: opts.previousTime || '', target: 'timeline', refId: node.key });
    } else {
      recentEventLabel.value = `${node.label} ${dayjs(appliedTime).format('HH:mm')}`;
      pushRecentEntry({ kind: 'timeline', label: node.label, time: appliedTime, target: 'timeline', refId: node.key });
    }
    activeTab.value = 'anesthesia';
    liveSheetRef.value?.flashEventType(node.eventType ?? node.label);
    Message.success(opts.clear ? `已清除：${node.label}（历史审计保留）` : `已更新：${node.label}`);
  } catch (e) {
    const err = e as { code?: number; message?: string };
    if (err.code === 4003) {
      Message.error(err.message ?? '无权限修改关键时间');
    } else if (err.code === 4091) {
      Message.error('记录版本冲突，请刷新后重试');
      timelineSyncVersion.value = 0;
    } else {
      Message.error(err.message ?? '关键时间保存失败');
    }
  }
};

/**
 * 关键时间统一保存入口（当前任务弹窗 / 顶部快捷事件 / 时间轴拖动 均走此函数）。
 * 区分首录/修改/清除/异常覆盖，强制原因与审计，不建立第二套时间数据。
 */
const saveTimelineNode = (
  node: MethodTimelineNode,
  isoTime: string,
  options: { reason?: string; overrideOrder?: boolean; clear?: boolean; source?: string } = {},
) => {
  const record = current.value;
  if (!record) return;
  const previousTime = resolveTimelineNodeTime(record, node);
  const source = options.source ?? '人工录入';

  // 1) 清除已记录时间 → 视为修改，二次确认 + 原因必填。
  if (options.clear) {
    if (!options.reason?.trim()) { Message.warning('清除关键时间需填写原因'); return; }
    Modal.confirm({
      title: `确认清除「${node.label}」`,
      content: `原时间 ${previousTime ? formatTimelineClock(previousTime) : '—'} 将被清除，历史审计保留不删除。`,
      onOk: () => { commitTimelineNode(node, '', { reason: options.reason, previousTime, source, clear: true }); },
    });
    return;
  }

  // 2) 修改且原时间与新时间相同 → 不提交。
  if (previousTime && isoTime && isoTime === previousTime) {
    Message.info('时间未变化，未提交');
    return;
  }

  // 3) 顺序校验：error（无效/越界）不可覆盖；warning（顺序异常）可填原因覆盖。
  const validation = validateTimelineNodeTime(record, sheetMethodKeys.value, node, isoTime);
  if (validation.severity === 'error') {
    Message.warning(validation.message ?? '关键时间无效');
    return;
  }
  const isModify = Boolean(previousTime);
  const orderConflict = validation.orderConflict === true;

  // 4) 修改/异常覆盖必须带原因（弹窗已收集则直接保存；拖动/快捷事件未带则拦截引导）。
  if ((isModify || orderConflict) && !options.reason?.trim()) {
    Message.warning(orderConflict
      ? (validation.message ?? '时间顺序异常，请在关键时间弹窗填写原因后保存')
      : '修改已记录时间需填写原因，请在关键时间弹窗操作');
    return;
  }
  if (orderConflict && !options.overrideOrder) {
    Message.warning('时间顺序异常，请填写原因后点“确认仍然保存”');
    return;
  }

  commitTimelineNode(node, isoTime, {
    reason: options.reason,
    previousTime,
    source,
    overrideOrder: options.overrideOrder === true,
  });
};
const focusWorkbenchTimelineNode = (node: MethodTimelineNode) => {
  activeTimelineKey.value = node.key;
  sideTab.value = 'task';
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
  width: 100%;
  max-width: 100%;
  min-width: 0;
  /* 左侧手术间患者队列 + 中部主内容流；质控/提醒已并入右侧三标签侧栏，不再单独占列。 */
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}

.record-layout.queue-collapsed {
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
  width: 100%;
  max-width: 100%;
  overflow-x: clip;
  display: grid;
  /* 左侧主内容流（记录单）与右侧三标签工具箱同列同级，工具箱跨越主内容流全部行，
     sticky 保持常驻。大屏约 320px，1366 宽度控制在 280~300px。 */
  grid-template-columns: minmax(0, 1fr) clamp(280px, 18vw, 320px);
  gap: 12px;
}

/* 侧栏折叠：真正释放侧栏宽度到窄栏（约 52px），记录单立即扩展占满释放空间。
   不用 visibility/display 隐藏占位，而是直接收缩 grid 列宽。 */
.record-center.toolbox-collapsed {
  grid-template-columns: minmax(0, 1fr) 52px;
}

/* 抢救模式：轻量非打印横幅，替代整张记录单强红框。 */
.rescue-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 6px;
  padding: 4px 10px;
  border: 1px solid #fecaca;
  border-left: 4px solid #dc2626;
  border-radius: 6px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 12px;
}

.rescue-banner strong {
  font-size: 13px;
  font-weight: 800;
}

.rescue-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #dc2626;
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.18);
}

.rescue-desc {
  color: #991b1b;
}

.rescue-exit {
  margin-left: auto;
}

/* 提醒标签内设备异常 / 同步区块。 */
.reminder-block {
  display: grid;
  gap: 6px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #e2e8f0;
}

.reminder-block header {
  display: flex;
  justify-content: space-between;
  color: #64748b;
  font-size: 12px;
}

.reminder-links {
  gap: 8px;
}

/* 提醒计数来源细分。 */
.reminder-summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 8px;
  border: 1px solid #eef2f7;
  border-radius: 6px;
  background: #f8fafc;
  font-size: 12px;
}

.reminder-summary strong { color: #0f172a; font-size: 13px; }
.reminder-summary-tag { padding: 1px 7px; border-radius: 999px; background: #fff; border: 1px solid #e2e8f0; color: #475569; }
.reminder-summary-empty { color: #94a3b8; }

/* 当前任务→关键时间区域（复用 TimelineNodeRail 单数据源，唯一主要入口）。 */
.keytime-card {
  border: 1px solid #dbe6f3;
  background: #fff;
}
.keytime-card :deep(.arco-card-header) {
  padding: 8px 12px;
  border-bottom: 1px solid #f0f2f5;
}
.keytime-card :deep(.arco-card-body) {
  padding: 4px 8px 8px;
}
.keytime-progress {
  color: #64748b;
  font-size: 12px;
}

/* 设备标签病例操作区。 */
.device-ops {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.device-paused-hint {
  margin-top: 8px;
  font-size: 11px;
}

.device-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.device-detail-grid > div {
  display: grid;
  gap: 2px;
}

.device-detail-grid span {
  color: #64748b;
  font-size: 11px;
}

.device-detail-grid strong {
  color: #0f172a;
  font-size: 13px;
  word-break: break-all;
}

.device-op-tip {
  margin: 0 0 10px;
  color: #64748b;
  font-size: 12px;
}

.record-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-column: 1;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow-x: clip;
  gap: 10px;
  align-items: start;
}

.record-detail-collapse {
  margin-top: 4px;
  grid-column: 1;
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
  align-self: start;
  grid-column: 2;
  grid-row: 1 / -1;
  min-width: 0;
  min-height: 0;
  top: var(--record-topbar-offset);
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 8px;
  /* 工具箱实际起点比 sticky 阈值低 10px；扣除该差值后，底部与视口
     保持 16px 安全边距，避免右侧再出现一段无意义的页面滚动。 */
  height: calc(100dvh - var(--record-topbar-offset) - 26px);
  max-height: calc(100dvh - var(--record-topbar-offset) - 26px);
  overflow: hidden;
  padding: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.98);
}

.record-toolbox.collapsed {
  grid-template-rows: auto;
  align-self: start;
  max-height: none;
  height: auto;
  /* 折叠后仅保留窄图标栏（40~48px）。 */
  width: 46px;
  min-width: 46px;
  padding: 6px 4px;
}

/* 三标签栏：当前任务 / 设备 / 提醒。 */
.toolbox-tabs {
  display: flex;
  align-items: stretch;
  gap: 2px;
  padding: 4px;
  border-radius: 6px;
  background: #eef2f7;
}

/* 右栏只允许这一处纵向滚动，避免常驻区在低视口下挤死下方功能。 */
.toolbox-scroll-zone {
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 8px 4px 0 0;
  scrollbar-gutter: stable;
}

/* 关键时间列表不再制造狭窄的嵌套滚动条，与标签面板共用唯一滚动容器。 */
.toolbox-scroll-zone :deep(.timeline-rail:not(.embedded) .timeline-list) {
  max-height: none;
  overflow: visible;
  scrollbar-gutter: auto;
}

.toolbox-scroll-zone > .toolbox-tab-pane > * {
  flex: 0 0 auto;
}

.toolbox-tab {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  padding: 5px 6px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.toolbox-tab.active {
  background: #fff;
  color: #0f172a;
  box-shadow: 0 1px 2px rgb(15 23 42 / 8%);
}

.toolbox-tab-badge {
  display: inline-block;
  margin-left: 3px;
  min-width: 15px;
  padding: 0 4px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 15px;
  text-align: center;
}

/* 设备数量角标为信息色（非告警红），表示实际设备数量。 */
.toolbox-tab-badge.is-count,
.toolbox-rail-badge.is-count {
  background: #1d4ed8;
}

/* 标签内容面板：与滚动区共用单一滚动条，不产生嵌套滚动。 */
.toolbox-tab-pane {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: visible;
}

/* 折叠窄栏：仅图标/短文字入口。 */
.toolbox-rail {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.toolbox-rail-btn {
  position: relative;
  padding: 8px 2px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  text-align: center;
  cursor: pointer;
}

.toolbox-rail-btn.active {
  border-color: var(--primary-6, rgb(22, 93, 255));
  color: var(--primary-6, rgb(22, 93, 255));
}

.toolbox-rail-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 15px;
  padding: 0 3px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 15px;
}

/* 当前任务：持续泵入停止操作。 */
.toolbox-pumps {
  padding: 8px 10px;
  border: 1px solid #fde68a;
  border-radius: 6px;
  background: #fffbeb;
}

.toolbox-pumps header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  color: #92400e;
  font-size: 12px;
}

.toolbox-pumps-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

/* 更多工具入口按钮。 */
.toolbox-more-btn {
  flex: 1 1 auto;
  padding: 4px 10px;
  border: 1px solid var(--primary-6, rgb(22, 93, 255));
  border-radius: 5px;
  background: #fff;
  color: var(--primary-6, rgb(22, 93, 255));
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.toolbox-collapsed-title {
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  writing-mode: vertical-rl;
  text-align: center;
}

/* 更多工具抽屉：宽度 660（最大 90vw），一级导航固定顶部，内容唯一纵向滚动。 */
.more-tools-drawer {
  max-width: 90vw;
}

/* 一级导航单独占一行，水平滚动不换行，不与下方业务标题重叠。 */
.more-tools-nav {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  padding: 8px 12px;
  margin: 0 -16px 8px;
  border-bottom: 1px solid #eef2f7;
  background: #fff;
  overflow-x: auto;
  scrollbar-width: thin;
}

.more-tools-nav-btn {
  padding: 5px 10px;
  border: 1px solid #e5edf5;
  border-radius: 999px;
  background: #fff;
  color: #475569;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
}

.more-tools-nav-btn.active {
  border-color: #165dff;
  background: #f6fbff;
  color: #165dff;
  font-weight: 700;
}

/* 唯一纵向滚动容器：抽屉内部各卡片不再各自滚动。 */
.more-tools-scroll {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

.more-tools-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.more-tools-title {
  margin: 0;
  color: #0f172a;
  font-size: 13px;
  font-weight: 700;
}

.more-tools-links {
  gap: 8px;
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
  .record-center {
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
  .record-center {
    grid-template-columns: 1fr;
  }

  /* 小屏工具箱为覆盖式抽屉，不再占据 grid 列；折叠不释放宽度。 */
  .record-center.toolbox-collapsed {
    grid-template-columns: 1fr;
  }

  /* 小屏不再把工具箱静态堆到页面底部，改为右侧抽屉：浮动按钮唤起、遮罩关闭。 */
  .record-toolbox {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(92vw, 360px);
    height: 100dvh;
    max-height: 100dvh;
    grid-column: auto;
    grid-row: auto;
    grid-template-rows: auto auto minmax(0, 1fr);
    border-radius: 0;
    transform: translateX(100%);
    transition: transform 0.2s ease;
    z-index: 1100;
    box-shadow: -8px 0 24px rgba(15, 23, 42, 0.18);
  }

  .record-toolbox.drawer-open {
    transform: translateX(0);
  }

  .toolbox-drawer-close {
    display: inline-flex;
  }

  .toolbox-flow-zone {
    overflow: visible;
  }

  .record-toolbox-fab {
    display: inline-flex;
  }

  .record-toolbox-overlay {
    display: block;
  }
}

/* 桌面端：浮动按钮、遮罩、抽屉关闭按钮默认隐藏。 */
.record-toolbox-fab {
  display: none;
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 900;
  align-items: center;
  justify-content: center;
  padding: 9px 16px;
  border: none;
  border-radius: 999px;
  background: rgb(var(--primary-6, 22, 93, 255));
  color: #fff;
  font-size: 13px;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.22);
  cursor: pointer;
}

.record-toolbox-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 1050;
  background: rgba(15, 23, 42, 0.4);
}

.toolbox-head-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.toolbox-drawer-close {
  display: none;
}

@media (max-width: 900px) {
  .record-layout {
    grid-template-columns: 1fr;
  }

  .patient-queue {
    position: static;
    max-height: none;
  }
}

@page {
  size: A4 portrait;
  margin: 3mm 6mm;
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
    width: 100% !important;
    max-width: 100% !important;
    height: auto !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    overflow: visible !important;
    zoom: 1 !important;
  }

  :global(.app-shell),
  :global(.app-main),
  :global(.app-content) {
    height: auto !important;
    min-height: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
  }

  .no-print {
    display: none !important;
  }

  :global(.arco-message-list),
  :global(.arco-message-wrapper),
  :global(.arco-notification-list),
  :global(.arco-trigger-popup),
  :global(.arco-modal-container) {
    display: none !important;
  }

  .anesthesia-record-workstation.print-preview-active > .record-layout,
  .anesthesia-record-workstation.print-preview-active :deep(.record-workstation-topbar) {
    display: none !important;
  }

  .app-sider,
  .app-header,
  .app-subnav,
  .app-footer,
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
