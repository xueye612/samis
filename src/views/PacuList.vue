<template>
  <ModulePageShell title="PACU恢复室总览" description="多复苏室床位矩阵、占用率与患者状态">
    <template #chips>
      <a-tag color="arcoblue">在室 {{ currentPatients.length }}</a-tag>
      <a-tag color="orangered">超时 {{ delayPatients.length }}</a-tag>
      <a-tag>占用率 {{ bedStats.occupancy }}%</a-tag>
    </template>
    <template #stats>
      <MetricCard label="总床位数" :value="bedStats.total" icon="IconHome" />
      <MetricCard label="使用床位" :value="bedStats.used" icon="IconHeart" />
      <MetricCard label="空闲床位" :value="bedStats.free" icon="IconCheckCircle" />
      <MetricCard label="占用率" :value="`${bedStats.occupancy}%`" icon="IconBarChart" />
    </template>
    <a-card class="section-card" :bordered="false">
      <template #title>床位状态矩阵</template>
      <template #extra>
        <a-space>
          <a-select v-model="selectedRoomId" style="width: 160px">
            <a-option value="">全部复苏室</a-option>
            <a-option v-for="room in store.pacuRooms" :key="room.id" :value="room.id">{{ room.name }}</a-option>
          </a-select>
          <a-button @click="router.push('/pacu/receive')">PACU 接收</a-button>
          <a-button @click="router.push('/pacu/transfer')">转出管理</a-button>
        </a-space>
      </template>
      <div v-for="room in visibleRooms" :key="room.id" class="pacu-room-block">
        <div class="pacu-room-head">
          <strong>{{ room.name }}</strong>
          <span class="muted">{{ room.code }} · {{ room.bedCount }} 床</span>
        </div>
        <div class="bed-matrix">
          <div
            v-for="bed in room.beds"
            :key="bed.id"
            class="bed-card"
            :class="`bed-card--${bedStatusClass(bed.status)}`"
          >
            <div class="bed-card__no">{{ bed.bedNo }}</div>
            <div class="bed-card__status">{{ bed.status }}</div>
            <div v-if="bed.patientName" class="bed-card__patient">{{ bed.patientName }}</div>
            <a-button v-if="bed.caseId" size="mini" type="text" @click="router.push(`/pacu/record/${bed.caseId}`)">查看</a-button>
          </div>
        </div>
      </div>
    </a-card>
    <a-card class="section-card" :bordered="false" title="PACU 患者列表">
      <a-table :data="store.pacuPatients" row-key="id" :pagination="false">
        <template #columns>
          <a-table-column title="患者" data-index="patientName" />
          <a-table-column title="手术间" data-index="room" />
          <a-table-column title="入PACU"><template #cell="{ record }">{{ formatTime(record.inTime) }}</template></a-table-column>
          <a-table-column title="停留"><template #cell="{ record }"><a-tag :color="stayMinutes(record) > 120 ? 'red' : 'green'">{{ stayMinutes(record) }}分</a-tag></template></a-table-column>
          <a-table-column title="HR" data-index="HR" />
          <a-table-column title="BP" data-index="BP" />
          <a-table-column title="SpO2" data-index="SpO2" />
          <a-table-column title="状态"><template #cell="{ record }"><StatusTag :value="record.status" /></template></a-table-column>
          <a-table-column title="操作" :width="120">
            <template #cell="{ record }">
              <a-button size="mini" type="primary" @click="router.push(`/pacu/record/${record.id}`)">恢复记录</a-button>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>
  </ModulePageShell>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import MetricCard from '@/components/MetricCard.vue';
import StatusTag from '@/components/StatusTag.vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { PacuPatient } from '@/types/anesthesia';
import type { PacuBed } from '@/types/clinicalModules';

const router = useRouter();
const store = useAnesthesiaStore();
const selectedRoomId = ref('');
const bedStats = computed(() => store.pacuBedStats);
const visibleRooms = computed(() => store.filteredPacuRooms(selectedRoomId.value || undefined));
const stayMinutes = (item: PacuPatient) => dayjs(item.outTime ?? new Date()).diff(dayjs(item.inTime), 'minute');
const formatTime = (value: string) => dayjs(value).format('HH:mm');
const currentPatients = computed(() => store.pacuPatients.filter((item) => item.status !== '已转出'));
const outPatients = computed(() => store.pacuPatients.filter((item) => item.status === '已转出'));
const delayPatients = computed(() => store.pacuPatients.filter((item) => stayMinutes(item) > 120 && item.status !== '已转出'));
const bedStatusClass = (status: PacuBed['status']) => ({ 空闲: 'free', 占用: 'busy', 预留: 'reserved', 维护: 'maint' }[status] ?? 'free');
</script>

<style scoped>
.pacu-room-block + .pacu-room-block { margin-top: var(--space-5); }
.pacu-room-head { display: flex; align-items: baseline; gap: var(--space-2); margin-bottom: var(--space-3); }
.bed-matrix { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: var(--space-3); }
.bed-card {
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--surface-muted);
}
.bed-card--free { background: rgb(220 252 231 / 50%); border-color: var(--color-success-100); }
.bed-card--busy { background: rgb(219 234 254 / 60%); border-color: var(--color-brand-100); }
.bed-card--reserved { background: rgb(255 237 213 / 50%); }
.bed-card--maint { background: rgb(241 245 249); opacity: 0.85; }
.bed-card__no { font-weight: 600; font-size: var(--font-size-sm); }
.bed-card__status { font-size: var(--font-size-xs); color: var(--text-tertiary); margin: 4px 0; }
.bed-card__patient { font-size: var(--font-size-sm); color: var(--text-secondary); }
</style>
