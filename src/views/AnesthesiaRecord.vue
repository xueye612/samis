<template>
  <div v-if="current" class="anesthesia-record-workstation">
    <section class="record-topbar">
      <div class="brand-block">
        <div class="brand-mark">麻</div>
        <div>
          <h1>麻醉记录单</h1>
          <p>{{ current.room }} · {{ current.patientName }} · {{ current.surgeryName }}</p>
        </div>
      </div>

      <div class="top-context">
        <a-tag :color="current.locked ? 'gray' : current.rescue ? 'red' : 'green'">{{ current.locked ? '已锁定' : current.rescue ? '抢救中' : current.recordStatus ?? '记录中' }}</a-tag>
        <span>采集：{{ current.device?.collectStatus ?? current.collectStatus ?? '未连接' }}</span>
        <span>数据源：{{ current.device?.dataSource ?? '手工录入 + 设备采集占位' }}</span>
      </div>

      <a-space wrap>
        <a-button type="primary" :disabled="current.locked" @click="startRecord">启动记录</a-button>
        <a-button :disabled="current.locked" @click="importVitals">设备采集</a-button>
        <a-button status="danger" :disabled="current.locked" @click="enterRescue">抢救模式</a-button>
        <a-button @click="runQuality">完整性检查</a-button>
        <a-button @click="() => saveDraft()">保存草稿</a-button>
        <a-button @click="printCurrent">打印预览</a-button>
        <a-button type="primary" status="success" :disabled="current.locked" @click="submitSignature">提交签名</a-button>
      </a-space>
    </section>

    <div class="work-mode-bar">
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
      </a-space>
    </div>

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
            <LiveAnesthesiaSheet
              :record="current"
              :vitals="vitalCatalog"
              :drugs="drugCatalog"
              :fluids="fluidCatalog"
              :blood-types="store.configGenericDicts.bloodTypes"
              :rh-types="store.configGenericDicts.rhTypes"
              :transfusion-reactions="store.configGenericDicts.transfusionReactions"
              :monitor-order="monitorOrder"
              :read-only="current.locked"
              :show-anesthesia-plane="sheetShowAnesthesiaPlane"
              :applied-template-name="sheetTemplateName"
              :applied-method-labels="sheetAppliedMethodLabels"
              :applied-modules="sheetAppliedModules"
              :template-impact="confirmedTemplateImpact"
              :recent-event-label="recentEventLabel"
              @select-event="selectSheetEvent"
              @save-medication="saveMedication"
              @save-fluid="saveFluid"
              @save-vital="saveVital"
              @save-output="saveOutput"
              @save-plane="savePlane"
              @save-monitor-order="saveMonitorOrder"
              @delete-record="deleteRecord"
            />
          </section>

          <aside class="record-toolbox">
            <IntraopWorkflowPanel
              :stage="currentStage"
              :method-labels="appliedMethodLabels"
              :selected-template-name="selectedTemplateName"
              :recent-event-label="recentEventLabel"
              :quick-events="stageQuickEvents"
              :pending-items="pendingLandingItems"
              :completion-gaps="completionGaps"
              :locked="current.locked"
              @quick-event="addEvent"
              @confirm-all="confirmAllLandingItems"
              @confirm-item="confirmLandingItem"
            />

            <a-collapse :default-active-key="['detail', 'templates']" :bordered="false">
              <a-collapse-item key="detail" header="事件补录">
                <EventDetailPanel
                  :event-name="selectedEventName"
                  :fields="confirmedLandingItems"
                  :completion-gaps="completionGaps"
                />
              </a-collapse-item>
              <a-collapse-item key="templates" header="方案初始化">
                <AnesthesiaTemplateSelector compact :selected-template-name="selectedTemplateName" @apply="applyTemplate" />
              </a-collapse-item>
              <a-collapse-item key="methods" header="麻醉方式">
                <AnesthesiaTypeSelector
                  compact
                  :primary="primaryMethod"
                  :auxiliary="auxiliaryMethods"
                  @update:primary="updatePrimaryMethod"
                  @update:auxiliary="updateAuxiliaryMethods"
                />
              </a-collapse-item>
              <a-collapse-item key="modules" header="专业字段预览">
                <DynamicAnesthesiaModules compact :methods="selectedMethodKeys" />
              </a-collapse-item>
            </a-collapse>
          </aside>
        </div>

        <RecordDetailTabs
          v-model:active-tab="activeTab"
          :record="current"
          :vital-items="vitalCatalog"
          :drug-items="drugCatalog"
          :fluid-items="fluidCatalog"
          :quality-checks="qualityChecks"
          @event="addEvent"
          @drug="addDrug"
          @fluid="addFluid"
        />
      </main>

      <RecordQualityPanel
        v-show="qualityPanelOpen"
        class="record-side"
        :record="current"
        :checks="qualityChecks"
        :abnormal-vitals="abnormalVitals"
      />
    </div>

    <a-modal v-model:visible="qualityVisible" title="麻醉记录单完整性检查" width="760px" :footer="false">
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
  </div>
  <a-empty v-else description="暂无麻醉记录单病例" />
</template>

<script setup lang="ts">
import { Message } from '@arco-design/web-vue';
import dayjs from 'dayjs';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AnesthesiaTemplateApplyModal from '@/components/anesthesia/record/AnesthesiaTemplateApplyModal.vue';
import AnesthesiaTemplateSelector from '@/components/anesthesia/record/AnesthesiaTemplateSelector.vue';
import AnesthesiaTypeSelector from '@/components/anesthesia/record/AnesthesiaTypeSelector.vue';
import DynamicAnesthesiaModules from '@/components/anesthesia/record/DynamicAnesthesiaModules.vue';
import EventDetailPanel from '@/components/anesthesia/record/EventDetailPanel.vue';
import IntraopWorkflowPanel from '@/components/anesthesia/record/IntraopWorkflowPanel.vue';
import LiveAnesthesiaSheet from '@/components/anesthesia/record/LiveAnesthesiaSheet.vue';
import RecordDetailTabs from '@/components/anesthesia/record/RecordDetailTabs.vue';
import RecordQualityPanel from '@/components/anesthesia/record/RecordQualityPanel.vue';
import { buildDrugCatalog, buildFluidCatalog, buildVitalCatalog } from '@/services/anesthesiaRecordEngine';
import {
  buildCompletionGaps,
  buildConfirmedTemplateImpact,
  buildTemplateApplyDraft,
  buildTemplateLandingDraft,
  buildQuickEventPayload,
  deriveCurrentStage,
  deriveMethodSelectionFromCase,
  getDynamicModuleEntries,
  getQuickEventOption,
  getMethodLabels,
  getStageQuickEvents,
  hasAnesthesiaPlaneModule,
  mergeSelectedMethods,
  type AnesthesiaTemplateApplyDraft,
  type TemplateLandingDraft,
} from '@/services/anesthesiaRecordMethodEngine';
import { sortCasesByClinicalPriority } from '@/services/scheduleHelpers';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { AnesthesiaMethodKey, TemplateLandingItem, TemplateQualityTip } from '@/mock/anesthesiaRecordPrototype';
import type { AnesthesiaEvent } from '@/types/anesthesia';
import type { AnesthesiaPlaneRecord, FluidRecord, MedicationRecord, OutputDetailRecord, SurgeryCase, VitalSign } from '@/types/anesthesia';

const route = useRoute();
const router = useRouter();
const store = useAnesthesiaStore();

const selectedId = ref(String(route.params.id || store.currentDoctorActiveCase?.id || store.myTodayCases[0]?.id || store.cases[0]?.id || ''));
const activeTab = ref(String((store.recordDrafts[selectedId.value] as { selectedTab?: string } | undefined)?.selectedTab ?? 'patient'));
const keyword = ref('');
const qualityVisible = ref(false);
const patientPanelOpen = ref(false);
const qualityPanelOpen = ref(false);
const primaryMethod = ref<AnesthesiaMethodKey>('general');
const auxiliaryMethods = ref<AnesthesiaMethodKey[]>([]);
const selectedTemplateName = ref('');
const templateModalVisible = ref(false);
const pendingTemplateDraft = ref<TemplateLandingDraft | null>(null);
const pendingLandingItems = ref<TemplateLandingItem[]>([]);
const confirmedLandingItems = ref<TemplateLandingItem[]>([]);
const confirmedQualityTips = ref<TemplateQualityTip[]>([]);
const recentEventLabel = ref('');
const selectedEventName = ref('');

const sortedCases = computed(() => sortCasesByClinicalPriority(store.cases));
const filteredCases = computed(() => {
  const text = keyword.value.trim();
  if (!text) return sortedCases.value;
  return sortedCases.value.filter((item) => [item.patientName, item.room, item.surgeryName, item.department].some((value) => value.includes(text)));
});
const current = computed(() => store.cases.find((item) => item.id === selectedId.value));
const drugCatalog = computed(() => buildDrugCatalog(store.configDrugs));
const vitalCatalog = computed(() => buildVitalCatalog(store.configVitals));
const fluidCatalog = computed(() => buildFluidCatalog(store.configFluids));
const qualityChecks = computed(() => selectedId.value ? store.liveRecordQualityChecks(selectedId.value) : []);
const abnormalVitals = computed(() => selectedId.value ? store.dictionaryDrivenAbnormalVitals(selectedId.value) : []);
const monitorOrder = computed(() => {
  const draft = store.recordDrafts[selectedId.value] as { monitorOrder?: string[] } | undefined;
  return draft?.monitorOrder ?? [];
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
const currentStage = computed(() => current.value ? deriveCurrentStage(current.value) : '入室后');
const stageQuickEvents = computed(() => getStageQuickEvents(currentStage.value, selectedMethodKeys.value, selectedTemplateName.value).slice(0, 10));
const confirmedTemplateImpact = computed(() => {
  if (!confirmedLandingItems.value.length) return undefined;
  const impact = buildConfirmedTemplateImpact(confirmedLandingItems.value);
  impact.qualityTips = confirmedQualityTips.value;
  return impact;
});
const completionGaps = computed(() => current.value ? buildCompletionGaps(current.value, selectedMethodKeys.value, confirmedTemplateImpact.value) : []);

watch(() => route.params.id, (id) => {
  if (id) selectedId.value = String(id);
});
watch(selectedId, (id) => {
  const draft = store.recordDrafts[id] as { selectedTab?: string } | undefined;
  activeTab.value = draft?.selectedTab ?? 'patient';
  const selection = deriveMethodSelectionFromCase(current.value);
  primaryMethod.value = selection.primary;
  auxiliaryMethods.value = selection.auxiliary;
  selectedTemplateName.value = '';
  pendingLandingItems.value = [];
  confirmedLandingItems.value = [];
  confirmedQualityTips.value = [];
  recentEventLabel.value = '';
  selectedEventName.value = '';
  pendingTemplateDraft.value = null;
  templateModalVisible.value = false;
});
watch(activeTab, () => saveDraft(false));
watch(current, (item) => {
  const selection = deriveMethodSelectionFromCase(item);
  primaryMethod.value = selection.primary;
  auxiliaryMethods.value = selection.auxiliary;
  selectedTemplateName.value = '';
  pendingLandingItems.value = [];
  confirmedLandingItems.value = [];
  confirmedQualityTips.value = [];
  recentEventLabel.value = '';
  selectedEventName.value = '';
  pendingTemplateDraft.value = null;
  templateModalVisible.value = false;
}, { immediate: true });

const selectCase = (id: string) => {
  selectedId.value = id;
  router.replace({ name: 'record', params: { id } });
};
const requireCurrent = (): SurgeryCase | undefined => current.value;
const startRecord = () => {
  if (!requireCurrent()) return;
  store.startAnesthesiaRecord(selectedId.value);
};
const importVitals = () => store.importRecordDeviceVitals(selectedId.value);
const enterRescue = () => store.enterRescueRecordMode(selectedId.value);
const runQuality = () => {
  qualityVisible.value = true;
  activeTab.value = 'quality';
};
const saveDraft = (withLog = true) => {
  if (!selectedId.value) return;
  const currentDraft = (store.recordDrafts[selectedId.value] && typeof store.recordDrafts[selectedId.value] === 'object')
    ? store.recordDrafts[selectedId.value] as Record<string, unknown>
    : {};
  store.saveRecordDraft(selectedId.value, { ...currentDraft, selectedTab: activeTab.value, lastSavedAt: dayjs().toISOString() });
  if (withLog && current.value) current.value.operationLogs = ['保存麻醉记录单草稿', ...(current.value.operationLogs ?? [])].slice(0, 8);
};
const printCurrent = () => window.print();
const submitSignature = () => {
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
const addEvent = (type: string) => {
  if (!current.value) return;
  const payload = buildQuickEventPayload(type, current.value);
  store.appendEvent(selectedId.value, payload);
  const option = getQuickEventOption(type);
  if (option.syncField && current.value) current.value[option.syncField] = payload.time;
  recentEventLabel.value = `${type} ${dayjs(payload.time).format('HH:mm')}`;
  selectedEventName.value = type;
  Message.success(`已记录：${recentEventLabel.value}`);
};
const confirmLandingItem = (landingId: string) => {
  const item = pendingLandingItems.value.find((entry) => entry.landingId === landingId);
  if (!item) return;
  confirmedLandingItems.value = [...confirmedLandingItems.value, { ...item, status: 'confirmed' }];
  pendingLandingItems.value = pendingLandingItems.value.filter((entry) => entry.landingId !== landingId);
  if (item.kind === 'event') selectedEventName.value = item.label;
  Message.success(`已确认落单：${item.label}`);
};
const confirmAllLandingItems = () => {
  if (!pendingLandingItems.value.length) return;
  confirmedLandingItems.value = [
    ...confirmedLandingItems.value,
    ...pendingLandingItems.value.map((item) => ({ ...item, status: 'confirmed' as const })),
  ];
  selectedEventName.value = pendingLandingItems.value.find((item) => item.kind === 'event')?.label ?? selectedEventName.value;
  const count = pendingLandingItems.value.length;
  pendingLandingItems.value = [];
  Message.success(`已确认${count}项落单`);
};
const selectSheetEvent = (event: Pick<AnesthesiaEvent, 'type'>) => {
  selectedEventName.value = event.type;
};
const addDrug = (name: string) => store.appendMedicationFromDict(selectedId.value, name);
const addFluid = (name: string) => store.appendFluidFromDict(selectedId.value, name);
const saveMedication = (record: MedicationRecord) => store.upsertMedication(selectedId.value, record);
const saveFluid = (record: FluidRecord) => store.upsertFluid(selectedId.value, record);
const saveVital = (record: VitalSign) => store.upsertVital(selectedId.value, record);
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
  grid-template-columns: 280px minmax(260px, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border: 1px solid #e5edf5;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
}

.work-mode-bar {
  position: sticky;
  top: 74px;
  z-index: 19;
  padding: 8px 10px;
  border: 1px solid #e5edf5;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.96);
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

.record-layout {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr) 300px;
  gap: 12px;
  align-items: start;
}

.record-layout.queue-collapsed {
  grid-template-columns: minmax(0, 1fr) 300px;
}

.record-layout.quality-collapsed {
  grid-template-columns: 260px minmax(0, 1fr);
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
}

.record-workspace {
  display: grid;
  grid-template-columns: minmax(860px, 1fr) 340px;
  gap: 14px;
  align-items: start;
}

.sheet-workbench {
  min-width: 0;
  padding: 10px;
  border: 1px solid #dbe6f3;
  border-radius: 8px;
  background: #f8fbff;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
}

.record-toolbox {
  position: sticky;
  top: 124px;
  display: grid;
  gap: 10px;
  max-height: calc(100vh - 140px);
  overflow: auto;
  padding: 10px;
  border: 1px solid #dbe6f3;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.98);
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

.record-side {
  position: sticky;
  top: 82px;
}

@media (max-width: 1400px) {
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

  .record-workspace {
    grid-template-columns: 1fr;
  }

  .record-toolbox {
    position: static;
    max-height: none;
  }
}

@media (max-width: 900px) {
  .record-topbar,
  .record-layout {
    grid-template-columns: 1fr;
  }

  .patient-queue {
    position: static;
    max-height: none;
  }
}

@media print {
  .app-sider,
  .app-header,
  .app-subnav,
  .record-topbar,
  .patient-queue,
  .record-side,
  .record-detail-tabs {
    display: none !important;
  }

  .anesthesia-record-workstation,
  .record-layout,
  .record-center {
    display: block !important;
    padding: 0 !important;
    background: #fff !important;
  }
}
</style>
