<template>
  <div class="page-stack">
    <a-card class="section-card" :bordered="false">
      <template #title>
        <span class="section-icon"><icon-calendar /></span>
        术后随访
      </template>
      <template #extra>
        <a-space>
          <a-tag color="green">VAS≤3 计入术后镇痛满意</a-tag>
          <a-tag color="orange">镇痛未随访 {{ missedAnalgesia.length }} 例</a-tag>
        </a-space>
      </template>
      <a-tabs v-model:active-key="activeTab">
        <a-tab-pane key="all" title="全部随访" />
        <a-tab-pane key="analgesia" title="术后镇痛随访" />
        <a-tab-pane key="general" title="全麻术后随访" />
        <a-tab-pane key="regional" title="区域阻滞术后随访" />
      </a-tabs>
      <a-table :data="filteredFollowUps" :pagination="false">
        <template #columns>
          <a-table-column title="患者"><template #cell="{ record }">{{ patientName(record.caseId) }}</template></a-table-column>
          <a-table-column title="随访类型" data-index="type" />
          <a-table-column title="随访时间"><template #cell="{ record }">{{ formatTime(record.followTime) }}</template></a-table-column>
          <a-table-column title="VAS"><template #cell="{ record }"><a-tag :color="record.vas <= 3 ? 'green' : 'orange'">{{ record.vas }}</a-tag></template></a-table-column>
          <a-table-column title="恶心呕吐"><template #cell="{ record }">{{ yesNo(record.nausea) }}</template></a-table-column>
          <a-table-column title="头痛"><template #cell="{ record }">{{ yesNo(record.headache) }}</template></a-table-column>
          <a-table-column title="声音嘶哑"><template #cell="{ record }">{{ yesNo(record.hoarseness) }}</template></a-table-column>
          <a-table-column title="肢体麻木"><template #cell="{ record }">{{ yesNo(record.numbness) }}</template></a-table-column>
          <a-table-column title="运动障碍"><template #cell="{ record }">{{ yesNo(record.motorDisorder) }}</template></a-table-column>
          <a-table-column title="术中知晓"><template #cell="{ record }">{{ yesNo(record.awareness) }}</template></a-table-column>
          <a-table-column title="呼吸抑制"><template #cell="{ record }">{{ yesNo(record.respiratoryDepression) }}</template></a-table-column>
          <a-table-column title="再插管"><template #cell="{ record }">{{ yesNo(record.reintubation) }}</template></a-table-column>
          <a-table-column title="转ICU"><template #cell="{ record }">{{ yesNo(record.transferredIcu) }}</template></a-table-column>
          <a-table-column title="死亡"><template #cell="{ record }">{{ yesNo(record.death) }}</template></a-table-column>
          <a-table-column title="处理意见" data-index="advice" />
        </template>
      </a-table>
      <a-empty v-if="!filteredFollowUps.length" description="当前分类暂无随访记录" />
    </a-card>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, ref } from 'vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { PostoperativeFollowUp } from '@/types/anesthesia';

const store = useAnesthesiaStore();
const activeTab = ref('all');

const tabTypeMap: Record<string, PostoperativeFollowUp['type'] | null> = {
  all: null,
  analgesia: '术后镇痛随访',
  general: '全麻术后随访',
  regional: '区域阻滞术后随访',
};

const filteredFollowUps = computed(() => {
  const type = tabTypeMap[activeTab.value];
  return type ? store.followUps.filter((item) => item.type === type) : store.followUps;
});

const formatTime = (value: string) => dayjs(value).format('MM-DD HH:mm');
const patientName = (caseId: string) => store.cases.find((item) => item.id === caseId)?.patientName ?? caseId;
const yesNo = (value: boolean) => (value ? '是' : '否');
const missedAnalgesia = computed(() => {
  const followed = new Set(store.followUps.filter((item) => item.type === '术后镇痛随访').map((item) => item.caseId));
  return store.cases.filter((item) => item.postoperativeAnalgesia && !followed.has(item.id));
});
</script>

<style scoped>
.section-card :deep(.arco-card-header-title) {
  display: inline-flex;
  align-items: center;
}
</style>
