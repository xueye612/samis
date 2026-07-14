<template>
  <a-drawer
    :visible="visible"
    :width="640"
    title="医院字段配置"
    unmount-on-close
    @cancel="emit('cancel')"
  >
    <a-alert v-if="!canManage" type="warning" show-icon style="margin-bottom: 12px">
      无医院字段配置权限（config.field.manage）；仅可查看，不可保存。
    </a-alert>
    <a-spin :loading="loading">
      <a-empty v-if="!fields.length" description="暂无字段配置基线" />
      <a-table v-else :data="fields" row-key="fieldCode" :pagination="false" size="medium">
        <template #columns>
          <a-table-column title="字段" data-index="fieldCode" />
          <a-table-column title="显示名称">
            <template #cell="{ record }">
              <a-input v-model="record.displayName" :disabled="!canManage" />
            </template>
          </a-table-column>
          <a-table-column title="显示" :width="80" align="center">
            <template #cell="{ record }">
              <a-switch v-model="record.visible" :disabled="!canManage || record.systemField" />
            </template>
          </a-table-column>
          <a-table-column title="必填" :width="80" align="center">
            <template #cell="{ record }">
              <a-switch v-model="record.required" :disabled="!canManage || record.serverRequired" />
            </template>
          </a-table-column>
          <a-table-column title="排序" :width="100">
            <template #cell="{ record }">
              <a-input-number v-model="record.sortNo" :disabled="!canManage" :min="0" />
            </template>
          </a-table-column>
          <a-table-column title="默认值">
            <template #cell="{ record }">
              <a-input v-model="record.defaultValue" :disabled="!canManage" placeholder="无" />
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-spin>
    <template #footer>
      <a-space>
        <a-button @click="emit('cancel')">取消</a-button>
        <a-button type="primary" :loading="saving" :disabled="!canManage" @click="onSave">保存</a-button>
      </a-space>
    </template>
  </a-drawer>
</template>

<script setup lang="ts">
import { Message } from '@arco-design/web-vue';
import { ref, watch } from 'vue';
import {
  loadHospitalFieldConfig,
  saveHospitalFieldConfig,
  RoomConfigConflictError,
} from '@/services/configuration/roomConfigurationService';

const props = defineProps<{ visible: boolean; hospitalCode: string; canManage: boolean }>();
const emit = defineEmits<{ (e: 'cancel'): void; (e: 'saved'): void }>();

const loading = ref(false);
const saving = ref(false);
const fields = ref<Array<Record<string, unknown>>>([]);
const original = ref<Array<Record<string, unknown>>>([]);

watch(
  () => props.visible,
  async (visible) => {
    if (!visible) return;
    await reload();
  },
  { immediate: true },
);

async function reload() {
  loading.value = true;
  try {
    const list = await loadHospitalFieldConfig(props.hospitalCode);
    fields.value = (Array.isArray(list) ? list : []).map((r) => ({ ...(r as Record<string, unknown>) }));
    original.value = fields.value.map((r) => ({ ...r }));
  } catch (error) {
    fields.value = [];
    if (error instanceof Error) Message.error(error.message);
  } finally {
    loading.value = false;
  }
}

async function onSave() {
  saving.value = true;
  try {
    for (let i = 0; i < fields.value.length; i++) {
      const cur = fields.value[i];
      const prev = original.value[i] ?? {};
      const expectedVersion = prev.version === null || prev.version === undefined ? 0 : Number(prev.version);
      const changes: Record<string, unknown> = {
        hospitalCode: props.hospitalCode,
        entityType: 'room',
        fieldCode: cur.fieldCode,
        expectedVersion,
      };
      if (cur.displayName !== prev.displayName) changes.displayName = cur.displayName;
      if (cur.visible !== prev.visible) changes.visible = cur.visible ? 1 : 0;
      if (cur.required !== prev.required) changes.required = cur.required ? 1 : 0;
      if (Number(cur.sortNo) !== Number(prev.sortNo)) changes.sortNo = Number(cur.sortNo);
      if (cur.defaultValue !== prev.defaultValue) changes.defaultValue = cur.defaultValue;
      if (Object.keys(changes).length <= 4) continue;
      await saveHospitalFieldConfig(changes);
    }
    Message.success('字段配置已保存');
    emit('saved');
  } catch (error) {
    if (error instanceof RoomConfigConflictError) {
      Message.warning('数据已被其他人修改，请刷新后重试');
    } else if (error instanceof Error) {
      Message.error(error.message);
    }
  } finally {
    saving.value = false;
  }
}
</script>
