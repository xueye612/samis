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
          @save-medication="saveMedication"
          @save-fluid="saveFluid"
          @save-vital="saveVital"
          @save-output="saveOutput"
          @save-plane="savePlane"
          @save-monitor-order="saveMonitorOrder"
          @delete-record="deleteRecord"
        />
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
  </div>
  <a-empty v-else description="暂无麻醉记录单病例" />
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import LiveAnesthesiaSheet from '@/components/anesthesia/record/LiveAnesthesiaSheet.vue';
import RecordDetailTabs from '@/components/anesthesia/record/RecordDetailTabs.vue';
import RecordQualityPanel from '@/components/anesthesia/record/RecordQualityPanel.vue';
import { buildDrugCatalog, buildFluidCatalog, buildVitalCatalog } from '@/services/anesthesiaRecordEngine';
import { sortCasesByClinicalPriority } from '@/services/scheduleHelpers';
import { useAnesthesiaStore } from '@/stores/anesthesia';
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

watch(() => route.params.id, (id) => {
  if (id) selectedId.value = String(id);
});
watch(selectedId, (id) => {
  const draft = store.recordDrafts[id] as { selectedTab?: string } | undefined;
  activeTab.value = draft?.selectedTab ?? 'patient';
});
watch(activeTab, () => saveDraft(false));

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
const addEvent = (type: string) => {
  store.appendEvent(selectedId.value, {
    type,
    stage: type === '抢救' ? '术中' : '入室后',
    severity: type === '抢救' ? '危急' : '轻度',
    treatment: '麻醉记录单快捷记录关键节点。',
  });
  if (type === '麻醉开始' && current.value) current.value.anesthesiaStart = dayjs().toISOString();
  if (type === '手术开始' && current.value) current.value.surgeryStart = dayjs().toISOString();
  if (type === '手术结束' && current.value) current.value.surgeryEnd = dayjs().toISOString();
  if (type === '离室' && current.value) current.value.leaveRoomTime = dayjs().toISOString();
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
