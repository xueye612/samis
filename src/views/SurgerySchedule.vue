<template>
  <div class="page-stack">
    <section class="module-hero">
      <div>
        <h2 class="module-hero__title">手术排班</h2>
        <p class="module-hero__desc">列表与周历视图协同，支持房间排班与急诊插单；数据来自手术通知单与护理排班接口。</p>
      </div>
      <a-space>
        <a-tag v-if="store.operationListSource" size="small" :color="sourceTagColor">{{ sourceLabel }}</a-tag>
        <a-button :loading="scheduleLoading" @click="reloadSchedule">
          <template #icon><icon-refresh /></template>
          刷新
        </a-button>
      </a-space>
    </section>
    <a-tabs v-model:active-key="scheduleTab" type="rounded" class="schedule-tabs">
      <a-tab-pane key="list" title="列表视图">
        <div class="page-toolbar surgery-toolbar">
          <a-space wrap>
            <a-date-picker v-model="filterDate" style="width: 140px" @change="reloadSchedule" />
            <a-select
              v-model="filterRoom"
              placeholder="全部手术间"
              allow-clear
              style="width: 140px"
              :options="filterRoomOptions"
              @change="reloadSchedule"
            />
            <a-input
              v-model="filterPatientName"
              placeholder="患者姓名"
              allow-clear
              style="width: 120px"
              @press-enter="reloadSchedule"
            />
            <a-input
              v-model="filterInpatientNo"
              placeholder="住院号"
              allow-clear
              style="width: 120px"
              @press-enter="reloadSchedule"
            />
            <a-radio-group v-model="viewMode" type="button">
              <a-radio value="room">房间排班</a-radio>
              <a-radio value="mine">我的排班</a-radio>
              <a-radio value="list">全院列表</a-radio>
            </a-radio-group>
            <a-button type="primary" @click="openCreate(false)">
              <template #icon><icon-plus /></template>
              新增手术
            </a-button>
            <a-button status="danger" @click="openCreate(true)">
              <template #icon><icon-plus-circle /></template>
              急诊插单
            </a-button>
          </a-space>
          <a-input-search v-model="keyword" class="toolbar-search" placeholder="本地筛选：患者、手术、科室" allow-clear />
        </div>

        <a-alert type="info" show-icon>
          手术通知单由 `getOperationList` 加载；人员排班由 `getNursePbList` 合并展示。保存时分别调用 `updateOperationInfo` 与 `saveNursePb`，不写入麻醉记录单临床数据。
        </a-alert>

        <a-spin :loading="scheduleLoading" class="schedule-spin">
          <a-card v-if="viewMode !== 'list'" class="section-card" :bordered="false">
            <template #title>{{ viewMode === 'mine' ? `${store.currentDoctorName} 我的排班` : '手术间房间视图' }}</template>
            <div class="room-schedule-grid">
              <div v-for="group in visibleRoomGroups" :key="group.roomId" class="room-schedule-card">
                <div class="room-schedule-head">
                  <strong>{{ group.roomName }}</strong>
                  <a-tag>{{ group.cases.length }} 台</a-tag>
                </div>
                <div v-if="group.cases.length" class="room-schedule-list">
                  <div
                    v-for="item in group.cases"
                    :key="item.id"
                    class="room-schedule-item"
                    :class="{ mine: store.isMyCase(item), emergency: item.emergencyInserted || item.urgency === '急诊' }"
                  >
                    <div class="schedule-time">
                      <strong>{{ formatRange(item) }}</strong>
                      <span>第 {{ item.sequence }} 台</span>
                    </div>
                    <div class="schedule-info">
                      <div>
                        <strong>{{ item.patientName }}</strong>
                        <span>{{ item.department }} · {{ item.surgeryName }}</span>
                      </div>
                      <div class="schedule-tags">
                        <a-tag v-if="store.isMyCase(item)" color="arcoblue">本人负责</a-tag>
                        <a-tag v-if="item.emergencyInserted || item.urgency === '急诊'" color="red">急诊插单</a-tag>
                        <StatusTag :value="item.status" />
                      </div>
                    </div>
                    <div class="schedule-actions">
                      <span>{{ item.anesthesiologist }} / {{ item.anesthesiaNurse }}</span>
                      <a-space>
                        <a-button size="mini" type="primary" @click="goRecord(item.id)">记录单</a-button>
                        <a-button size="mini" @click="router.push(`/surgery/detail/${item.id}`)">详情</a-button>
                      </a-space>
                    </div>
                  </div>
                </div>
                <a-empty v-else description="暂无排班" />
              </div>
            </div>
          </a-card>

          <a-card class="section-card" :bordered="false">
            <template #title>
              <a-space>
                <span>{{ viewMode === 'list' ? '全院排班列表' : '排班明细' }}</span>
                <a-radio-group v-model="listDataMode" type="button" size="small">
                  <a-radio value="operation">手术通知单</a-radio>
                  <a-radio value="nurse">护理排班</a-radio>
                </a-radio-group>
              </a-space>
            </template>
            <a-table
              class="compact-table"
              :data="filteredCases"
              :pagination="{ pageSize: 8 }"
              row-key="id"
              :scroll="{ x: 1900 }"
            >
              <template #empty>
                <a-empty :description="scheduleEmptyDescription" />
              </template>
              <template #columns>
                <a-table-column title="手术间" data-index="room" :width="90" />
                <a-table-column title="时间" :width="150">
                  <template #cell="{ record }">{{ formatRange(record) }}</template>
                </a-table-column>
                <a-table-column title="台次" :width="100">
                  <template #cell="{ record }">
                    <a-input-number
                      v-model="stationDrafts[record.id]"
                      :min="1"
                      :max="99"
                      size="small"
                      style="width: 72px"
                      @change="(v) => onStationDraftChange(record.id, Number(v ?? 1))"
                    />
                  </template>
                </a-table-column>
                <a-table-column title="患者" data-index="patientName" :width="90" />
                <a-table-column title="住院号" :width="100">
                  <template #cell="{ record }">{{ record.patientId ?? '-' }}</template>
                </a-table-column>
                <a-table-column title="科室" data-index="department" />
                <a-table-column title="拟施手术" data-index="surgeryName" />
                <a-table-column title="麻醉医师" data-index="anesthesiologist" />
                <a-table-column title="麻醉护士" data-index="anesthesiaNurse" />
                <a-table-column title="状态" :width="100">
                  <template #cell="{ record }"><StatusTag :value="record.status" /></template>
                </a-table-column>
                <a-table-column title="操作" fixed="right" :width="320">
                  <template #cell="{ record }">
                    <a-space>
                      <a-button size="small" type="primary" @click="goRecord(record.id)">麻醉记录单</a-button>
                      <a-button size="small" @click="openEdit(record)">编辑</a-button>
                      <a-button size="small" status="warning" @click="store.cancelCase(record.id)">取消</a-button>
                    </a-space>
                  </template>
                </a-table-column>
              </template>
            </a-table>
            <div v-if="stationDirtyCount > 0" class="station-batch-bar">
              <span>已修改 {{ stationDirtyCount }} 条台次</span>
              <a-button type="primary" size="small" :loading="stationSaving" @click="saveStationBatch">保存台次</a-button>
            </div>
          </a-card>
        </a-spin>

        <a-drawer v-model:visible="drawerVisible" width="640px" :title="editing?.id?.startsWith('case-new') ? '新增手术排班' : '编辑手术排班'" :ok-button-props="{ disabled: !editing || formDisabled }" @ok="saveCase">
          <a-form v-if="editing" :model="editing" :disabled="formDisabled" layout="vertical">
            <a-alert v-if="useRealOperationInfo() && !canEditMaster" type="warning" show-icon class="drawer-tip">
              无手术主数据修改权限（operation.master_data.update）；仅可查看，不可保存主数据。
            </a-alert>
            <a-alert v-else type="normal" show-icon class="drawer-tip">
              主数据走受控修改（权限+白名单+版本+字段审计）；护理排班/台次单独保存。不保存用药与生命体征。
            </a-alert>
            <a-descriptions v-if="useRealOperationInfo() && !editing.id.startsWith('case-new')" :column="3" size="mini" class="drawer-meta" :data="masterDataMeta" />
            <a-form-item v-if="useRealOperationInfo() && canEditMaster && !editing.id.startsWith('case-new')" label="修改原因（必填）">
              <a-input v-model="masterDataReason" placeholder="请填写本次主数据修改原因" :max-length="200" />
            </a-form-item>
            <a-row :gutter="12">
              <a-col :span="8"><a-form-item label="手术间"><a-select v-model="editing.room" :options="drawerRoomOptions" /></a-form-item></a-col>
              <a-col :span="8"><a-form-item label="台次"><a-input-number v-model="editing.sequence" :min="1" /></a-form-item></a-col>
              <a-col :span="8"><a-form-item label="状态"><a-select v-model="editing.status" :options="statusOptions" :disabled="useRealOperationInfo()" /></a-form-item></a-col>
              <a-col :span="12"><a-form-item label="预计开始"><a-date-picker v-model="editing.scheduledStart" show-time format="YYYY-MM-DD HH:mm" style="width: 100%" /></a-form-item></a-col>
              <a-col :span="12"><a-form-item label="预计结束"><a-date-picker v-model="editing.scheduledEnd" show-time format="YYYY-MM-DD HH:mm" style="width: 100%" /></a-form-item></a-col>
              <a-col :span="8"><a-form-item label="患者"><a-input v-model="editing.patientName" /></a-form-item></a-col>
              <a-col :span="8"><a-form-item label="性别"><a-select v-model="editing.gender" :options="['男', '女']" /></a-form-item></a-col>
              <a-col :span="8"><a-form-item label="年龄"><a-input-number v-model="editing.age" /></a-form-item></a-col>
              <a-col :span="12"><a-form-item label="科室"><a-input v-model="editing.department" /></a-form-item></a-col>
              <a-col :span="12"><a-form-item label="诊断"><a-input v-model="editing.diagnosis" /></a-form-item></a-col>
              <a-col :span="24"><a-form-item label="拟施手术"><a-input v-model="editing.surgeryName" /></a-form-item></a-col>
              <a-col :span="12"><a-form-item label="手术医师"><a-input v-model="editing.surgeon" /></a-form-item></a-col>
              <a-col :span="12"><a-form-item label="麻醉方式"><a-input v-model="editing.anesthesiaMethod" /></a-form-item></a-col>
              <a-col :span="12"><a-form-item label="麻醉医师"><a-select v-model="editing.anesthesiologist" :options="store.doctorOptions.map((d) => ({ label: d, value: d }))" allow-search /></a-form-item></a-col>
              <a-col :span="12"><a-form-item label="麻醉护士"><a-input v-model="editing.anesthesiaNurse" /></a-form-item></a-col>
              <a-col :span="12"><a-form-item label="急诊插单"><a-switch v-model="editing.emergencyInserted" :disabled="useRealOperationInfo()" /></a-form-item></a-col>
            </a-row>
          </a-form>
          <div v-if="useRealOperationInfo() && editing && !editing.id.startsWith('case-new') && masterDataAudit.length" class="drawer-audit">
            <h4>主数据修改审计</h4>
            <a-table :data="masterDataAudit" :pagination="false" size="mini">
              <template #columns>
                <a-table-column title="字段" data-index="label" :width="90" />
                <a-table-column title="变更前" data-index="before" :width="90" />
                <a-table-column title="变更后" data-index="after" :width="90" />
                <a-table-column title="原因" data-index="reason" />
                <a-table-column title="操作人" data-index="actorId" :width="80" />
                <a-table-column title="角色" data-index="actorRole" :width="80" />
                <a-table-column title="时间" data-index="occurredAt" :width="140" />
              </template>
            </a-table>
          </div>
        </a-drawer>
      </a-tab-pane>
      <a-tab-pane key="calendar" title="日历视图">
        <a-card class="section-card" :bordered="false" title="本周排班概览">
          <div class="week-grid">
            <div v-for="day in weekDays" :key="day.key" class="week-day">
              <div class="week-day__head">
                <strong>{{ day.label }}</strong>
                <span class="muted">{{ day.date }}</span>
                <a-tag size="small">{{ day.cases.length }}</a-tag>
              </div>
              <div v-if="day.cases.length" class="week-day__list">
                <div v-for="item in day.cases" :key="item.id" class="week-case" @click="goRecord(item.id)">
                  <span class="week-case__time">{{ dayjs(item.scheduledStart ?? item.plannedStart).format('HH:mm') }}</span>
                  <strong>{{ item.patientName }}</strong>
                  <span class="muted">{{ item.room }} · {{ item.surgeryName }}</span>
                </div>
              </div>
              <a-empty v-else description="无排班" />
            </div>
          </div>
        </a-card>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import { useRouter } from 'vue-router';
import StatusTag from '@/components/StatusTag.vue';
import { useRealOperationInfo } from '@/config/apiFlags';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import {
  buildMasterDataChangesFromDiff,
  buildSaveNursePbPayload,
  loadNurseScheduleList,
  matchCaseRoom,
  mergeNurseScheduleIntoCases,
  persistOperationInfoFields,
  saveNurseSchedule,
  updateOperationStations,
} from '@/services/anesthesia/scheduleService';
import {
  canEditMasterData,
  MasterDataConflictError,
  MasterDataPermissionError,
  saveScheduleMasterData,
  type MasterDataAuditEntry,
} from '@/services/anesthesia/operationMasterDataService';
import { authApi } from '@/api/auth';
import type { SurgeryCase } from '@/types/anesthesia';

const router = useRouter();
const store = useAnesthesiaStore();
const scheduleTab = ref('list');
const scheduleLoading = ref(false);
const stationSaving = ref(false);
const keyword = ref('');
const viewMode = ref<'room' | 'mine' | 'list'>('room');
const listDataMode = ref<'operation' | 'nurse'>('operation');

const filterDate = ref(dayjs().format('YYYY-MM-DD'));
const filterRoom = ref<string>();
const filterPatientName = ref('');
const filterInpatientNo = ref('');

const stationDrafts = reactive<Record<string, number>>({});
const stationDirty = reactive<Record<string, boolean>>({});

const drawerVisible = ref(false);
const editing = ref<SurgeryCase>();
const originalSequence = ref<number>();
const editingSnapshot = ref<SurgeryCase>();
const permissions = ref<string[]>([]);
const masterDataReason = ref('');
const masterDataAudit = ref<MasterDataAuditEntry[]>([]);
const canEditMaster = computed(() => canEditMasterData(permissions.value));
const formDisabled = computed(() => useRealOperationInfo() && !canEditMaster.value);

const dash = (v: unknown) => (v === undefined || v === null || v === '') ? '—' : String(v);
const masterDataMeta = computed(() => {
  const oc = editing.value?.operationCase;
  return [
    { label: '版本', value: dash(oc?.version) },
    { label: '来源系统', value: dash(oc?.sourceSystem) },
    { label: '来源表', value: dash(oc?.sourceTable) },
    { label: '最后更新', value: dash(oc?.lastUpdatedAt) },
  ];
});

const statusOptions = ['待入室', '已入室', '麻醉诱导', '麻醉中', '手术中', '苏醒中', 'PACU', '已离室', '已取消'];

const filterRoomOptions = computed(() => [
  { label: '全部手术间', value: '' },
  ...store.configRooms.map((item) => ({ label: item, value: item })),
]);

const drawerRoomOptions = computed(() =>
  store.configRooms.map((item) => ({ label: item, value: item })),
);

const sourceLabel = computed(() => {
  const map: Record<string, string> = { remote: '真实接口', mock: 'Mock' };
  return map[store.operationListSource] ?? store.operationListSource;
});

const sourceTagColor = computed(() => {
  if (store.operationListSource === 'remote') return 'green';
  return 'gray';
});

const scheduleEmptyDescription = computed(() => {
  if (scheduleLoading.value) return '正在加载…';
  if (!store.cases.length && useRealOperationInfo()) {
    return '当日手术通知单暂无数据（远程接口已返回空列表）';
  }
  if (!filteredCases.value.length) return '当前筛选条件下无排班';
  return '暂无排班数据';
});

const weekStart = computed(() => dayjs().startOf('week').add(1, 'day'));
const weekDays = computed(() =>
  Array.from({ length: 7 }, (_, i) => {
    const date = weekStart.value.add(i, 'day');
    const cases = store.sortedCases.filter((item) =>
      dayjs(item.scheduledStart ?? item.plannedStart).isSame(date, 'day'),
    );
    return {
      key: date.format('YYYY-MM-DD'),
      label: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][i],
      date: date.format('MM-DD'),
      cases,
    };
  }),
);

const sourceCases = computed(() => (viewMode.value === 'mine' ? store.myTodayCases : store.sortedCases));

const filteredCases = computed(() => {
  let source = sourceCases.value;
  if (filterRoom.value) {
    source = source.filter((item) => matchCaseRoom(item, filterRoom.value!));
  }
  const word = keyword.value.trim();
  if (word) {
    source = source.filter((item) =>
      `${item.room}${item.patientName}${item.department}${item.surgeryName}${item.diagnosis}`.includes(word),
    );
  }
  return source;
});

const visibleRoomGroups = computed(() => {
  const source = viewMode.value === 'mine' ? store.myTodayCases : filteredCases.value;
  return store.roomSchedule
    .map((group) => ({
      ...group,
      cases: source.filter((item) =>
        matchCaseRoom(item, group.roomId) || matchCaseRoom(item, group.roomName),
      ),
    }))
    .filter((group) => viewMode.value !== 'mine' || group.cases.length > 0);
});

const stationDirtyCount = computed(() => Object.values(stationDirty).filter(Boolean).length);

function syncStationDrafts() {
  store.cases.forEach((item) => {
    stationDrafts[item.id] = item.sequence;
    stationDirty[item.id] = false;
  });
}

async function reloadSchedule() {
  scheduleLoading.value = true;
  try {
    await store.loadRemoteOperationList({
      operationDate: filterDate.value,
      room: filterRoom.value || undefined,
      patientName: filterPatientName.value.trim() || undefined,
      inpatientNo: filterInpatientNo.value.trim() || undefined,
    });
    if (listDataMode.value === 'nurse') {
      const nurseRows = await loadNurseScheduleList(filterDate.value);
      store.cases = mergeNurseScheduleIntoCases(store.cases, nurseRows);
    }
    syncStationDrafts();
  } finally {
    scheduleLoading.value = false;
  }
}

watch(listDataMode, () => {
  void reloadSchedule();
});

function onStationDraftChange(caseId: string, value: number) {
  const item = store.cases.find((c) => c.id === caseId);
  stationDirty[caseId] = item ? value !== item.sequence : true;
}

async function saveStationBatch() {
  // 真实模式台次必须通过受控主数据信封（含版本/原因）保存，不调用无凭据旁路接口
  if (useRealOperationInfo()) {
    Message.warning('真实模式下台次修改请在编辑抽屉中填写原因后随主数据保存');
    return;
  }
  const items = Object.entries(stationDirty)
    .filter(([, dirty]) => dirty)
    .map(([operationId]) => {
      const row = store.cases.find((c) => c.id === operationId);
      return {
        operationId,
        numberOfStations: stationDrafts[operationId] ?? row?.sequence ?? 1,
        room: row?.room,
      };
    });
  if (!items.length) return;
  stationSaving.value = true;
  try {
    await updateOperationStations(items);
    items.forEach(({ operationId, numberOfStations }) => {
      const index = store.cases.findIndex((c) => c.id === operationId);
      if (index >= 0) {
        store.cases[index] = { ...store.cases[index], sequence: numberOfStations };
        stationDirty[operationId] = false;
      }
    });
    Message.success('台次已保存');
  } catch (error) {
    Message.warning(error instanceof Error ? error.message : '台次保存失败');
  } finally {
    stationSaving.value = false;
  }
}

const clone = (item: SurgeryCase) => JSON.parse(JSON.stringify(item)) as SurgeryCase;

const formatRange = (item: SurgeryCase) => {
  const start = item.scheduledStart ?? item.plannedStart;
  const end = item.scheduledEnd ?? item.surgeryEnd ?? dayjs(start).add(item.expectedDurationMinutes || 60, 'minute').toISOString();
  return `${dayjs(start).format('HH:mm')} - ${dayjs(end).format('HH:mm')}`;
};

const goRecord = (id: string) => router.push(`/surgery/record/${id}`);

const openEdit = (item: SurgeryCase) => {
  editing.value = clone(item);
  editingSnapshot.value = clone(item);
  originalSequence.value = item.sequence;
  masterDataReason.value = '';
  masterDataAudit.value = [];
  drawerVisible.value = true;
  if (useRealOperationInfo()) {
    loadMasterDataAudit(item.id);
  }
};

async function loadMasterDataAudit(operationId: string) {
  try {
    const result = await authApi.auditByOperation(operationId);
    const list = (result as { list?: unknown })?.list ?? [];
    masterDataAudit.value = (Array.isArray(list) ? list : [])
      .filter((row) => {
        const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
        return r.module === 'operation' && r.action === 'masterDataUpdate';
      })
      .flatMap((row) => {
        const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
        const summary = Array.isArray(r.changeSummary) ? r.changeSummary : [];
        const base = {
          actorId: r.actorId != null ? String(r.actorId) : '—',
          actorRole: r.actorRole != null ? String(r.actorRole) : '—',
          occurredAt: r.occurredAt != null ? String(r.occurredAt) : '—',
          result: r.result != null ? String(r.result) : '',
        };
        return summary.map((change) => {
          const c = (change && typeof change === 'object' ? change : {}) as Record<string, unknown>;
          return {
            field: String(c.field ?? ''),
            label: c.label != null ? String(c.label) : String(c.field ?? ''),
            before: c.before ?? '—',
            after: c.after ?? '—',
            reason: c.reason != null ? String(c.reason) : '—',
            ...base,
          } as MasterDataAuditEntry & { result: string };
        });
      });
  } catch {
    masterDataAudit.value = [];
  }
}

const openCreate = (emergency: boolean) => {
  const base = store.cases[0] ? clone(store.cases[0]) : undefined;
  const start = dayjs().add(emergency ? 20 : 180, 'minute').second(0).millisecond(0).toISOString();
  const room = filterRoom.value || store.configRooms[0] || 'OR-01';
  editing.value = {
    ...(base ?? {
      gender: '男',
      age: 40,
      department: '',
      diagnosis: '',
      surgeryName: '',
      surgeon: '',
      anesthesiaMethod: '全身麻醉',
      asa: 'II',
      urgency: '择期',
      locationType: '手术室内',
      expectedDurationMinutes: 90,
      locked: false,
      activeWarming: false,
      autologousBlood: false,
      postoperativeAnalgesia: false,
      preVisit: {
        completed: false,
        height: 170,
        weight: 65,
        asa: 'II',
        allergy: '无',
        anesthesiaHistory: '',
        difficultAirway: '',
        fasting: '',
        preMedication: '',
        specialCondition: '',
        plan: '',
        doctorSignature: '',
      },
      vitals: [],
      events: [],
      medications: [],
      fluids: [],
      outputs: { urine: 0, bloodLoss: 0, drainage: 0 },
    }),
    id: `case-new-${Date.now()}`,
    patientId: `patient-new-${Date.now()}`,
    room,
    roomId: room,
    roomName: room,
    sequence: emergency ? 99 : 2,
    patientName: emergency ? '急诊患者' : '',
    status: '待入室',
    urgency: emergency ? '急诊' : '择期',
    emergencyInserted: emergency,
    nursingScheduleSource: emergency ? '手术护理系统急诊插单' : '手术护理系统正式排班',
    anesthesiologist: store.currentDoctorName,
    assignedAnesthesiologistIds: [store.currentDoctorName],
    plannedStart: start,
    scheduledStart: start,
    scheduledEnd: dayjs(start).add(emergency ? 120 : 90, 'minute').toISOString(),
    expectedDurationMinutes: emergency ? 120 : 90,
    actualStart: undefined,
    roomInTime: undefined,
    anesthesiaStart: undefined,
    surgeryStart: undefined,
    surgeryEnd: undefined,
    anesthesiaEnd: undefined,
    leaveRoomTime: undefined,
    recordDocument: undefined,
    recordSnapshot: undefined,
    recordSummary: undefined,
    printedAt: undefined,
    operationLogs: ['手术护理系统新建排班'],
    locked: false,
  } as SurgeryCase;
  originalSequence.value = editing.value.sequence;
  drawerVisible.value = true;
};

const saveCase = async () => {
  if (!editing.value) return;
  const item = editing.value;
  const isNew = item.id.startsWith('case-new');
  // 真实模式下新增/急诊插单需独立创建接口，暂未开放
  if (useRealOperationInfo() && (isNew || item.emergencyInserted)) {
    Message.warning('真实模式下新增/急诊插单需独立创建接口，暂未开放');
    return;
  }
  // 真实模式无主数据权限：完全阻止保存（0 主数据/护理/台次写请求）
  if (useRealOperationInfo() && !canEditMaster.value) {
    Message.warning('无手术主数据修改权限');
    return;
  }
  item.roomId = item.room;
  item.roomName = item.room;
  item.plannedStart = item.scheduledStart ?? item.plannedStart;
  item.assignedAnesthesiologistIds = [item.anesthesiologist];

  if (useRealOperationInfo()) {
    // 受控主数据保存：权限门禁 + 修改原因 + POST 信封（台次随 sequence 进入信封）→ GET 回读 → 护理排班独立
    const changes = buildMasterDataChangesFromDiff(editingSnapshot.value ?? item, item);
    try {
      const outcome = await saveScheduleMasterData({
        permissions: permissions.value,
        item,
        reason: masterDataReason.value,
        changes,
        saveNursePb: (it, date) => saveNurseSchedule(buildSaveNursePbPayload(it, date ?? filterDate.value)),
        operationDate: filterDate.value,
      });
      store.upsertCase(outcome.case);
      masterDataAudit.value = outcome.audit;
      masterDataReason.value = '';
      if (outcome.nurseError) {
        Message.warning(`主数据已保存；护理排班：${outcome.nurseError}`);
      } else {
        Message.success('排班已保存');
      }
    } catch (error) {
      if (error instanceof MasterDataPermissionError) {
        Message.warning('无手术主数据修改权限');
      } else if (error instanceof MasterDataConflictError) {
        Message.warning('数据已被其他人修改，请刷新后重试');
      } else {
        Message.warning(error instanceof Error ? error.message : '主数据保存失败');
      }
      // 失败不保留本地主数据，保留抽屉与错误信息供重试
      return;
    }
  } else if (item.emergencyInserted) {
    store.createEmergencyCase(item);
    // Mock 模式保留护理排班与台次旁路（真实模式台次已随主数据信封保存）
    await saveNurseSchedule(buildSaveNursePbPayload(item, filterDate.value)).catch((e) => {
      Message.warning(e instanceof Error ? e.message : '护理排班保存失败');
    });
    if (originalSequence.value !== undefined && item.sequence !== originalSequence.value) {
      await updateOperationStations([{ operationId: item.id, numberOfStations: item.sequence, room: item.room }])
        .catch((e) => Message.warning(e instanceof Error ? e.message : '台次更新失败'));
    }
    Message.success('排班已保存');
  } else {
    store.upsertCase(item);
    await saveNurseSchedule(buildSaveNursePbPayload(item, filterDate.value)).catch((e) => {
      Message.warning(e instanceof Error ? e.message : '护理排班保存失败');
    });
    if (originalSequence.value !== undefined && item.sequence !== originalSequence.value) {
      await updateOperationStations([{ operationId: item.id, numberOfStations: item.sequence, room: item.room }])
        .catch((e) => Message.warning(e instanceof Error ? e.message : '台次更新失败'));
    }
    Message.success('排班已保存');
  }

  drawerVisible.value = false;
  await reloadSchedule();
};

onMounted(async () => {
  await store.bootstrapAnesthesiaLocalPersistence();
  if (!store.roomGroups.length) {
    await store.loadRoomCatalog();
  }
  if (useRealOperationInfo()) {
    try {
      const result = await authApi.myPermissions();
      // 真实返回结构为 { permissions, role, groupid }；页面读取 result.permissions
      permissions.value = Array.isArray(result?.permissions)
        ? result.permissions.map(String)
        : (Array.isArray(result) ? (result as unknown[]).map(String) : []);
    } catch {
      permissions.value = [];
    }
  }
  await reloadSchedule();
});
</script>

<style scoped>
.schedule-tabs {
  margin-top: var(--space-3);
}
.schedule-spin {
  display: block;
  width: 100%;
}
.station-batch-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.week-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--space-3);
}
.week-day {
  min-height: 160px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}
.week-day__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.week-day__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.week-case {
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  cursor: pointer;
  font-size: var(--font-size-xs);
}
.week-case:hover {
  background: rgb(219 234 254 / 40%);
}
.week-case__time {
  display: block;
  color: var(--color-brand-600);
  font-weight: 600;
}
.week-case strong {
  display: block;
  font-size: var(--font-size-sm);
}
.drawer-tip {
  margin-bottom: 12px;
}
.drawer-meta {
  margin-bottom: 12px;
}
.drawer-audit {
  margin-top: 16px;
}
.drawer-audit h4 {
  margin: 0 0 8px;
  font-size: var(--font-size-sm);
}
@media (max-width: 1200px) {
  .week-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
