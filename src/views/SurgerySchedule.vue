<template>
  <div class="page-stack">
    <div class="page-toolbar surgery-toolbar">
      <a-space wrap>
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
        <a-button @click="router.push('/quality/defects')">
          <template #icon><icon-exclamation-circle /></template>
          质控缺陷
        </a-button>
      </a-space>
      <a-input-search v-model="keyword" class="toolbar-search" placeholder="搜索患者、手术、科室、手术间" allow-clear />
    </div>

    <a-alert type="info" show-icon>
      患者基础信息由手术护理系统统一维护，麻醉侧通过 patientId 关联同一患者；本页聚焦排班协同、责任分配和状态追踪。
    </a-alert>

    <a-card v-if="viewMode !== 'list'" class="section-card" :bordered="false">
      <template #title>{{ viewMode === 'mine' ? `${store.currentDoctorName} 我的排班` : '手术间房间视图' }}</template>
      <div class="room-schedule-grid">
        <div v-for="group in visibleRoomGroups" :key="group.roomId" class="room-schedule-card">
          <div class="room-schedule-head">
            <strong>{{ group.roomName }}</strong>
            <a-tag>{{ group.cases.length }} 台</a-tag>
          </div>
          <div v-if="group.cases.length" class="room-schedule-list">
            <div v-for="item in group.cases" :key="item.id" class="room-schedule-item" :class="{ mine: store.isMyCase(item), emergency: item.emergencyInserted || item.urgency === '急诊' }">
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
                <a-button size="mini" type="primary" @click="router.push(`/surgery/detail/${item.id}`)">详情</a-button>
              </div>
            </div>
          </div>
          <a-empty v-else description="暂无排班" />
        </div>
      </div>
    </a-card>

    <a-card class="section-card" :bordered="false">
      <template #title>{{ viewMode === 'list' ? '全院排班列表' : '排班明细' }}</template>
      <a-table class="compact-table" :data="filteredCases" :pagination="{ pageSize: 8 }" row-key="id" :scroll="{ x: 1800 }">
        <template #columns>
          <a-table-column title="手术间" data-index="room" :width="90" />
          <a-table-column title="时间" :width="150">
            <template #cell="{ record }">{{ formatRange(record) }}</template>
          </a-table-column>
          <a-table-column title="台次" data-index="sequence" :width="70" />
          <a-table-column title="患者" data-index="patientName" :width="90" />
          <a-table-column title="性别" data-index="gender" :width="70" />
          <a-table-column title="年龄" data-index="age" :width="70" />
          <a-table-column title="科室" data-index="department" />
          <a-table-column title="诊断" data-index="diagnosis" />
          <a-table-column title="拟施手术" data-index="surgeryName" />
          <a-table-column title="手术医师" data-index="surgeon" />
          <a-table-column title="麻醉方式" data-index="anesthesiaMethod" />
          <a-table-column title="ASA" data-index="asa" :width="70" />
          <a-table-column title="急诊/择期" :width="110">
            <template #cell="{ record }">
              <a-tag :color="record.urgency === '急诊' ? 'red' : 'green'">{{ record.urgency }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="麻醉医师" data-index="anesthesiologist" />
          <a-table-column title="麻醉护士" data-index="anesthesiaNurse" />
          <a-table-column title="护理排班来源" data-index="nursingScheduleSource" :width="170" />
          <a-table-column title="本人负责" :width="100">
            <template #cell="{ record }"><a-tag v-if="store.isMyCase(record)" color="arcoblue">是</a-tag><span v-else class="muted">否</span></template>
          </a-table-column>
          <a-table-column title="状态" :width="100">
            <template #cell="{ record }"><StatusTag :value="record.status" /></template>
          </a-table-column>
          <a-table-column title="操作" fixed="right" :width="280">
            <template #cell="{ record }">
              <a-space>
                <a-button size="small" @click="router.push(`/surgery/detail/${record.id}`)">
                  <template #icon><icon-eye /></template>
                  详情
                </a-button>
                <a-button size="small" @click="openEdit(record)">
                  <template #icon><icon-edit /></template>
                  编辑
                </a-button>
                <a-button size="small" status="warning" @click="store.cancelCase(record.id)">
                  <template #icon><icon-close /></template>
                  取消
                </a-button>
                <a-button size="small" type="primary" @click="router.push(`/surgery/detail/${record.id}`)">
                  <template #icon><icon-file /></template>
                  患者详情
                </a-button>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <a-drawer v-model:visible="drawerVisible" width="640px" :title="editing?.id ? '编辑手术排班' : '新增手术排班'" @ok="saveCase">
      <a-form v-if="editing" :model="editing" layout="vertical">
        <a-alert type="normal" show-icon class="drawer-tip">
          patientId：{{ editing.patientId || '保存后生成' }}，患者资料与手术护理系统共享。
        </a-alert>
        <a-row :gutter="12">
          <a-col :span="8"><a-form-item label="手术间"><a-select v-model="editing.room" :options="roomOptions" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="台次"><a-input-number v-model="editing.sequence" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="状态"><a-select v-model="editing.status" :options="statusOptions" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="预计开始"><a-date-picker v-model="editing.scheduledStart" show-time format="YYYY-MM-DD HH:mm" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="预计结束"><a-date-picker v-model="editing.scheduledEnd" show-time format="YYYY-MM-DD HH:mm" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="患者"><a-input v-model="editing.patientName" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="性别"><a-select v-model="editing.gender" :options="['男', '女']" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="年龄"><a-input-number v-model="editing.age" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="科室"><a-input v-model="editing.department" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="诊断"><a-input v-model="editing.diagnosis" /></a-form-item></a-col>
          <a-col :span="24"><a-form-item label="拟施手术"><a-input v-model="editing.surgeryName" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="手术医师"><a-input v-model="editing.surgeon" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="麻醉方式"><a-input v-model="editing.anesthesiaMethod" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="ASA"><a-select v-model="editing.asa" :options="['I', 'II', 'III', 'IV', 'V']" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="类型"><a-select v-model="editing.urgency" :options="['择期', '急诊']" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="预计分钟"><a-input-number v-model="editing.expectedDurationMinutes" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="麻醉医师"><a-select v-model="editing.anesthesiologist" :options="store.doctorOptions" allow-search /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="麻醉护士"><a-input v-model="editing.anesthesiaNurse" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="排班来源"><a-input v-model="editing.nursingScheduleSource" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="急诊插单"><a-switch v-model="editing.emergencyInserted" /></a-form-item></a-col>
        </a-row>
      </a-form>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import StatusTag from '@/components/StatusTag.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { SurgeryCase } from '@/types/anesthesia';

const router = useRouter();
const store = useAnesthesiaStore();
const keyword = ref('');
const viewMode = ref<'room' | 'mine' | 'list'>('room');
const drawerVisible = ref(false);
const editing = ref<SurgeryCase>();
const statusOptions = ['待入室', '已入室', '麻醉诱导', '麻醉中', '手术中', '苏醒中', 'PACU', '已离室', '已取消'];
const roomOptions = computed(() => store.configRooms.filter((item) => item.startsWith('OR-')).map((item) => ({ label: item, value: item })));

const sourceCases = computed(() => (viewMode.value === 'mine' ? store.myTodayCases : store.sortedCases));
const filteredCases = computed(() => {
  const word = keyword.value.trim();
  const source = sourceCases.value;
  if (!word) return source;
  return source.filter((item) => `${item.room}${item.patientName}${item.department}${item.surgeryName}${item.diagnosis}`.includes(word));
});
const visibleRoomGroups = computed(() => {
  const source = viewMode.value === 'mine' ? store.myTodayCases : filteredCases.value;
  return store.roomSchedule
    .filter((group) => group.roomId.startsWith('OR-'))
    .map((group) => ({ ...group, cases: source.filter((item) => item.room === group.roomId) }))
    .filter((group) => viewMode.value !== 'mine' || group.cases.length > 0);
});

const clone = (item: SurgeryCase) => JSON.parse(JSON.stringify(item)) as SurgeryCase;
const formatRange = (item: SurgeryCase) => {
  const start = item.scheduledStart ?? item.plannedStart;
  const end = item.scheduledEnd ?? item.surgeryEnd ?? dayjs(start).add(item.expectedDurationMinutes || 60, 'minute').toISOString();
  return `${dayjs(start).format('HH:mm')} - ${dayjs(end).format('HH:mm')}`;
};
const openEdit = (item: SurgeryCase) => {
  editing.value = clone(item);
  drawerVisible.value = true;
};
const openCreate = (emergency: boolean) => {
  const base = clone(store.cases[0]);
  const start = dayjs().add(emergency ? 20 : 180, 'minute').second(0).millisecond(0).toISOString();
  editing.value = {
    ...base,
    id: `case-new-${Date.now()}`,
    patientId: `patient-new-${Date.now()}`,
    room: emergency ? 'OR-03' : 'OR-01',
    roomId: emergency ? 'OR-03' : 'OR-01',
    roomName: emergency ? 'OR-03' : 'OR-01',
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
    locked: false,
    events: [],
    vitals: [],
    medications: [],
    fluids: [],
    outputRecords: [],
  };
  drawerVisible.value = true;
};
const saveCase = () => {
  if (!editing.value) return;
  editing.value.roomId = editing.value.room;
  editing.value.roomName = editing.value.room;
  editing.value.plannedStart = editing.value.scheduledStart ?? editing.value.plannedStart;
  editing.value.assignedAnesthesiologistIds = [editing.value.anesthesiologist];
  if (editing.value.emergencyInserted) store.createEmergencyCase(editing.value);
  else store.upsertCase(editing.value);
};
</script>
