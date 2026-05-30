<template>
  <ModulePageShell title="紧急呼叫" description="手术室、PACU 等区域紧急协助请求">
    <template #chips>
      <a-tag color="red">待处理 {{ pendingCount }}</a-tag>
    </template>
    <a-card class="section-card" :bordered="false" title="呼叫列表">
      <a-table :data="store.emergencyCalls" row-key="id" :pagination="false">
        <template #columns>
          <a-table-column title="时间" data-index="time" :width="80" />
          <a-table-column title="类型" data-index="type" :width="160" />
          <a-table-column title="呼叫方" data-index="caller" :width="120" />
          <a-table-column title="位置" data-index="location" />
          <a-table-column title="严重程度" :width="100">
            <template #cell="{ record }">
              <a-tag :color="record.severity === '危急' ? 'red' : record.severity === '紧急' ? 'orange' : 'gray'">
                {{ record.severity }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="描述" data-index="description" />
          <a-table-column title="状态" :width="100">
            <template #cell="{ record }">
              <a-tag :color="record.status === '已解决' ? 'green' : 'orangered'">{{ record.status }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="120" fixed="right">
            <template #cell="{ record }">
              <a-button
                size="mini"
                type="primary"
                :disabled="record.status === '已解决'"
                @click="resolve(record.id)"
              >
                标记解决
              </a-button>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Message } from '@arco-design/web-vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';

const store = useAnesthesiaStore();
const pendingCount = computed(() => store.emergencyCalls.filter((c) => c.status !== '已解决').length);

const resolve = (id: string) => {
  store.resolveEmergencyCall(id);
  Message.success('紧急呼叫已标记为解决');
};
</script>
