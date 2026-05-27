<template>
  <div class="page-stack">
    <div class="page-toolbar">
      <div>
        <h2 class="page-title">手术间态势</h2>
        <p class="page-desc">实时查看各手术间患者、麻醉方式与质控预警</p>
      </div>
      <a-button type="outline" @click="router.push('/workbench/overview')">
        <template #icon><icon-dashboard /></template>
        返回工作台
      </a-button>
    </div>
    <div class="room-grid">
      <div
        v-for="item in store.cases"
        :key="item.id"
        class="room-card-v2"
        :class="{ 'room-card-v2--active': ['麻醉诱导', '麻醉中', '手术中'].includes(item.status) }"
      >
        <div class="room-card-v2__head">
          <span class="room-card-v2__name">{{ item.room }}</span>
          <StatusTag :value="item.status" />
        </div>
        <div class="patient-title">{{ item.patientName }} {{ item.gender }} {{ item.age }}岁</div>
        <div class="muted">{{ item.department }} · {{ item.surgeryName }}</div>
        <a-divider margin="12px" />
        <a-space wrap>
          <a-tag>{{ item.anesthesiaMethod }}</a-tag>
          <a-tag color="arcoblue">ASA {{ item.asa }}</a-tag>
        </a-space>
        <div class="room-card__warnings">
          <a-tag v-for="warning in roomWarnings(item.id)" :key="warning" color="orange">{{ warning }}</a-tag>
        </div>
        <div class="room-card__footer toolbar">
          <a-button size="small" type="primary" @click="router.push(`/surgery/detail/${item.id}`)">详情</a-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import StatusTag from '@/components/StatusTag.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';

const router = useRouter();
const store = useAnesthesiaStore();
const roomWarnings = (caseId: string) => store.qualityDefects.filter((item) => item.caseId === caseId).slice(0, 2).map((item) => item.defectType);
</script>
