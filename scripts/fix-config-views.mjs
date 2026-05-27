import fs from 'fs';
import path from 'path';

const configs = [
  ['ConfigRooms.vue', 'configRooms', '手术间管理'],
  ['ConfigStaff.vue', 'configStaff', '麻醉人员'],
  ['ConfigMethods.vue', 'configMethods', '麻醉方式字典'],
  ['ConfigDrugs.vue', 'configDrugs', '药品字典'],
  ['ConfigFluids.vue', 'configFluids', '液体/血制品字典'],
  ['ConfigEvents.vue', 'configEvents', '事件字典'],
  ['ConfigScores.vue', 'configScores', '评分模板'],
  ['ConfigPrint.vue', 'configPrintTemplates', '打印模板'],
];

configs.forEach(([file, key, title]) => {
  const content = `<template>
  <DictCrudPanel title="${title}" :model-value="list" @update:model-value="save" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import DictCrudPanel from '@/components/shared/DictCrudPanel.vue';
import { useAnesthesiaStore, type DictListKey } from '@/stores/anesthesia';

const store = useAnesthesiaStore();
const key = '${key}' as DictListKey;
const list = computed(() => store[key] as string[]);
const save = (value: string[]) => store.upsertDictList(key, value);
</script>
`;
  fs.writeFileSync(path.join('src/views/config', file), content);
});
