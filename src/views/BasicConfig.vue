<template>
  <div class="page-stack">
    <a-card class="section-card" :bordered="false">
      <template #title>
        <span class="section-icon"><icon-settings /></span>
        基础配置
      </template>
      <div class="config-grid">
        <a-card :bordered="true">
          <template #title>
            <AppIcon name="IconHome" :size="16" />
            <span>手术间配置</span>
          </template>
          <a-list size="small">
            <a-list-item v-for="room in rooms" :key="room">
              <a-tag color="arcoblue">{{ room }}</a-tag>
              已启用麻醉记录单、设备采集、PACU转运
            </a-list-item>
          </a-list>
        </a-card>
        <a-card :bordered="true">
          <template #title>
            <AppIcon name="IconExperiment" :size="16" />
            <span>常用麻醉药品</span>
          </template>
          <a-space wrap>
            <a-tag v-for="drug in commonDrugs" :key="drug" color="cyan">{{ drug }}</a-tag>
          </a-space>
        </a-card>
        <a-card :bordered="true">
          <template #title>
            <AppIcon name="IconExclamationCircle" :size="16" />
            <span>质控规则开关</span>
          </template>
          <a-space direction="vertical">
            <a-checkbox default-checked>全麻体温记录完整性</a-checkbox>
            <a-checkbox default-checked>血压/脉搏5分钟间隔</a-checkbox>
            <a-checkbox default-checked>PACU转出延迟</a-checkbox>
            <a-checkbox default-checked>连续泵入停止时间</a-checkbox>
          </a-space>
        </a-card>
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import { commonDrugs } from '@/mock/anesthesiaCases';

const rooms = ['OR-01', 'OR-02', 'OR-03', 'OR-04', 'OR-05', 'OR-06', 'PACU'];
</script>

<style scoped>
.section-card :deep(.arco-card-header-title) {
  display: inline-flex;
  align-items: center;
}

.config-grid :deep(.arco-card-header-title) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>
