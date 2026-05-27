<template>
  <div class="page-stack">
    <section class="module-hero">
      <div>
        <h2 class="module-hero__title">PACU转出管理</h2>
        <p class="module-hero__desc">追踪待转出患者，标准化记录延迟原因与交接信息。</p>
      </div>
      <div class="module-hero__chips">
        <a-tag color="arcoblue">待转出 {{ pendingTransfer.length }}</a-tag>
        <a-tag color="red">超时 {{ delayPatients.length }}</a-tag>
      </div>
    </section>
    <div class="stat-grid">
      <MetricCard label="待转出" :value="pendingTransfer.length" color="orange" tag="待办" icon="IconSwap" />
      <MetricCard label="观察中" :value="observing.length" icon="IconHeart" />
      <MetricCard label="超2小时" :value="delayPatients.length" color="red" tag="预警" icon="IconExclamationCircle" />
      <MetricCard label="今日已转出" :value="transferredToday.length" icon="IconHome" />
    </div>

    <a-card class="section-card" :bordered="false" title="PACU转出管理">
      <template #extra>
        <a-button type="outline" @click="router.push('/pacu/list')">
          <template #icon><icon-list /></template>
          返回患者列表
        </a-button>
      </template>
      <a-table :data="pendingTransfer" row-key="id" :pagination="false">
        <template #columns>
          <a-table-column title="患者" data-index="patientName" :width="90" />
          <a-table-column title="手术间" data-index="room" :width="90" />
          <a-table-column title="入PACU"><template #cell="{ record }">{{ formatTime(record.inTime) }}</template></a-table-column>
          <a-table-column title="停留"><template #cell="{ record }"><a-tag :color="stayMinutes(record) > 120 ? 'red' : 'arcoblue'">{{ stayMinutes(record) }} 分钟</a-tag></template></a-table-column>
          <a-table-column title="Aldrete" data-index="aldrete" :width="80" />
          <a-table-column title="状态"><template #cell="{ record }"><StatusTag :value="record.status" /></template></a-table-column>
          <a-table-column title="拟转往" data-index="transferTo" />
          <a-table-column title="操作" :width="220">
            <template #cell="{ record }">
              <a-space>
                <a-button size="small" type="primary" @click="openTransfer(record.id)">
                  <template #icon><icon-swap /></template>
                  登记转出
                </a-button>
                <a-button size="small" @click="router.push(`/pacu/record/${record.id}`)">
                  <template #icon><icon-file /></template>
                  记录
                </a-button>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
      <a-empty v-if="!pendingTransfer.length" description="当前无待转出患者" />
    </a-card>

    <a-drawer v-model:visible="drawerVisible" title="登记 PACU 转出" width="480px" @ok="confirmTransfer">
      <a-form v-if="editing" :model="editing" layout="vertical">
        <a-form-item label="患者"><a-input :model-value="editing.patientName" readonly /></a-form-item>
        <a-form-item label="转出地点">
          <a-select v-model="editing.transferTo" :options="['病房', 'ICU', '日间病房', '留观']" />
        </a-form-item>
        <a-form-item label="当前状态">
          <a-select v-model="editing.status" :options="['待转出', '已转出']" />
        </a-form-item>
        <a-form-item v-if="stayMinutes(editing) > 120" label="延迟原因">
          <a-textarea v-model="delayReason" placeholder="停留超过2小时需说明原因" :auto-size="{ minRows: 3 }" />
        </a-form-item>
        <a-form-item label="交接摘要">
          <a-textarea v-model="editing.handover" :auto-size="{ minRows: 4 }" />
        </a-form-item>
      </a-form>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import MetricCard from '@/components/MetricCard.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { PacuPatient } from '@/types/anesthesia';

const router = useRouter();
const store = useAnesthesiaStore();
const drawerVisible = ref(false);
const delayReason = ref('');
const editing = ref<PacuPatient>();

const stayMinutes = (item: PacuPatient) => dayjs(item.outTime ?? new Date()).diff(dayjs(item.inTime), 'minute');
const formatTime = (value: string) => dayjs(value).format('MM-DD HH:mm');
const isToday = (value?: string) => !!value && dayjs(value).isSame(dayjs(), 'day');

const pendingTransfer = computed(() => store.pacuPatients.filter((item) => item.status !== '已转出'));
const observing = computed(() => store.pacuPatients.filter((item) => item.status === '观察中'));
const delayPatients = computed(() => pendingTransfer.value.filter((item) => stayMinutes(item) > 120));
const transferredToday = computed(() => store.pacuPatients.filter((item) => item.status === '已转出' && isToday(item.outTime)));

const clone = (item: PacuPatient) => JSON.parse(JSON.stringify(item)) as PacuPatient;

const openTransfer = (id: string) => {
  const target = store.pacuPatients.find((item) => item.id === id);
  if (!target) return;
  editing.value = clone(target);
  delayReason.value = '';
  drawerVisible.value = true;
};

const confirmTransfer = () => {
  if (!editing.value) return;
  if (editing.value.status === '已转出') {
    editing.value.outTime = editing.value.outTime ?? new Date().toISOString();
  }
  if (stayMinutes(editing.value) > 120 && delayReason.value.trim()) {
    editing.value.handover = `${editing.value.handover}\n转出延迟说明：${delayReason.value.trim()}`.trim();
  }
  store.upsertPacuPatient(editing.value);
  drawerVisible.value = false;
};
</script>
