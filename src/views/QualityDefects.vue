<template>
  <div class="quality-page page-stack">
    <header class="quality-defects-head">
      <div>
        <h2>质控缺陷闭环管理</h2>
        <p>聚焦自动识别缺陷，统一追踪确认、整改与关闭状态。</p>
      </div>
      <a-tag color="red">{{ store.qualityDefects.length }} 条自动触发</a-tag>
    </header>
    <a-card class="section-card quality-defects-card" :bordered="false">
      <template #title>
        <icon-exclamation-circle />
        质控缺陷列表
      </template>
      <template #extra>
        <a-space>
          <a-button type="primary" @click="router.push('/quality/dashboard')">
            <template #icon><icon-bar-chart /></template>
            返回质控看板
          </a-button>
        </a-space>
      </template>
      <QualityDefectTable
        :defects="store.qualityDefects"
        @locate="goCaseDetail"
        @update-status="(id, patch) => store.updateDefectStatus(id, patch)"
      />
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import QualityDefectTable from '@/components/quality/QualityDefectTable.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';

const router = useRouter();
const store = useAnesthesiaStore();
const goCaseDetail = (caseId: string) => router.push({ name: 'record', params: { id: caseId }, query: { from: 'plan' } });
</script>

<style scoped>
.quality-defects-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  border: 1px solid var(--qc-border-soft);
  border-radius: var(--qc-radius);
  background: linear-gradient(120deg, rgb(255 241 242), var(--surface) 60%);
}

.quality-defects-head h2 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary);
}

.quality-defects-head p {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}
</style>
