<template>
  <ModulePageShell title="今日无排班" description="当前账号今日未安排手术班次">
    <a-result v-if="!store.hasShiftToday" status="info" title="今日暂无排班">
      <template #subtitle>
        您今日未列入手术麻醉排班。如有急诊支援需求，请关注紧急呼叫或联系科室值班。
      </template>
      <template #extra>
        <a-space>
          <a-button type="primary" @click="router.push('/workbench/emergency')">查看紧急呼叫</a-button>
          <a-button @click="router.push('/surgery/schedule')">查看全院排班</a-button>
        </a-space>
      </template>
    </a-result>
    <a-alert v-else type="success" show-icon>您今日已有排班，请前往工作台查看。</a-alert>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';

const store = useAnesthesiaStore();
const router = useRouter();
</script>
