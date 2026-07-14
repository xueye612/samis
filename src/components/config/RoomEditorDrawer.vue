<template>
  <a-drawer
    :visible="visible"
    :width="560"
    :title="isCreate ? '新增手术间' : '编辑手术间'"
    :mask-closable="false"
    unmount-on-close
    @cancel="emit('cancel')"
  >
    <a-form :model="form" layout="vertical">
      <a-form-item label="手术间编码" required>
        <a-input v-model="form.roomCode" placeholder="稳定业务编码，全局唯一" :disabled="!isCreate" />
      </a-form-item>
      <a-form-item label="手术间名称" required>
        <a-input v-model="form.roomName" placeholder="手术间名称" />
      </a-form-item>
      <a-form-item label="简称">
        <a-input v-model="form.shortName" />
      </a-form-item>
      <a-row :gutter="12">
        <a-col :span="12"><a-form-item label="所属手术部"><a-input v-model="form.roomGroupId" /></a-form-item></a-col>
        <a-col :span="12"><a-form-item label="院区"><a-input v-model="form.campus" /></a-form-item></a-col>
      </a-row>
      <a-row :gutter="12">
        <a-col :span="12"><a-form-item label="楼层"><a-input v-model="form.floor" /></a-form-item></a-col>
        <a-col :span="12"><a-form-item label="位置"><a-input v-model="form.location" /></a-form-item></a-col>
      </a-row>
      <a-row :gutter="12">
        <a-col :span="12"><a-form-item label="洁净等级"><a-input v-model="form.cleanLevel" /></a-form-item></a-col>
        <a-col :span="12"><a-form-item label="台位数量"><a-input-number v-model="form.stationCapacity" :min="0" /></a-form-item></a-col>
      </a-row>
      <a-row :gutter="12">
        <a-col :span="8"><a-form-item label="急诊能力"><a-switch v-model="form.emergencyCapable" /></a-form-item></a-col>
        <a-col :span="8"><a-form-item label="负压"><a-switch v-model="form.negativePressure" /></a-form-item></a-col>
        <a-col :span="8"><a-form-item label="复合手术间"><a-switch v-model="form.hybridRoom" /></a-form-item></a-col>
      </a-row>
      <a-row :gutter="12">
        <a-col :span="12"><a-form-item label="开放时间"><a-input v-model="form.openTime" placeholder="HH:mm" /></a-form-item></a-col>
        <a-col :span="12"><a-form-item label="关闭时间"><a-input v-model="form.closeTime" placeholder="HH:mm" /></a-form-item></a-col>
      </a-row>
      <a-form-item label="能力（可开展手术类型 / 麻醉方式 / 设备）">
        <div v-for="(cap, idx) in form.capabilities" :key="idx" class="cap-row">
          <a-select
            v-model="cap.capabilityType"
            :style="{ width: '140px' }"
            :options="capabilityTypeOptions"
          />
          <a-input v-model="cap.capabilityCode" placeholder="编码" :style="{ flex: 1 }" />
          <a-input v-model="cap.capabilityName" placeholder="名称（可选）" :style="{ flex: 1 }" />
          <a-button status="danger" @click="form.capabilities.splice(idx, 1)">移除</a-button>
        </div>
        <a-button type="dashed" @click="addCapability">新增能力</a-button>
      </a-form-item>
      <a-form-item label="备注">
        <a-textarea v-model="form.remark" :auto-size="{ minRows: 2 }" />
      </a-form-item>
    </a-form>

    <template #footer>
      <a-space>
        <a-button @click="emit('cancel')">取消</a-button>
        <a-button type="primary" :loading="saving" @click="onSave">保存</a-button>
      </a-space>
    </template>
  </a-drawer>
</template>

<script setup lang="ts">
import { Message } from '@arco-design/web-vue';
import { reactive, ref, watch } from 'vue';
import {
  createRoomConfiguration,
  updateRoomConfiguration,
  RoomConfigConflictError,
} from '@/services/configuration/roomConfigurationService';
import type { RoomConfiguration } from '@/services/anesthesia/adapters/roomAdapter';

interface EditorCapability {
  capabilityType: string;
  capabilityCode: string;
  capabilityName: string;
}

const props = defineProps<{ visible: boolean; room: RoomConfiguration | null }>();
const emit = defineEmits<{
  (e: 'cancel'): void;
  (e: 'saved'): void;
}>();

const isCreate = ref(true);
const saving = ref(false);
const form = reactive<{
  roomCode: string;
  roomName: string;
  shortName: string;
  roomGroupId: string;
  campus: string;
  floor: string;
  location: string;
  cleanLevel: string;
  stationCapacity: number;
  emergencyCapable: boolean;
  negativePressure: boolean;
  hybridRoom: boolean;
  openTime: string;
  closeTime: string;
  remark: string;
  expectedVersion: number;
  roomId: number;
  capabilities: EditorCapability[];
}>(blankForm());

const capabilityTypeOptions = [
  { label: '手术类型', value: 'operation_type' },
  { label: '麻醉方式', value: 'anesthesia_method' },
  { label: '设备', value: 'equipment' },
];

function blankForm() {
  return {
    roomCode: '',
    roomName: '',
    shortName: '',
    roomGroupId: '',
    campus: '',
    floor: '',
    location: '',
    cleanLevel: '',
    stationCapacity: 0,
    emergencyCapable: false,
    negativePressure: false,
    hybridRoom: false,
    openTime: '',
    closeTime: '',
    remark: '',
    expectedVersion: 1,
    roomId: 0,
    capabilities: [] as EditorCapability[],
  };
}

function addCapability() {
  form.capabilities.push({ capabilityType: 'operation_type', capabilityCode: '', capabilityName: '' });
}

watch(
  () => [props.visible, props.room] as const,
  ([visible]) => {
    if (!visible) return;
    const r = props.room;
    if (r) {
      isCreate.value = false;
      Object.assign(form, {
        roomCode: r.roomCode,
        roomName: r.roomName,
        shortName: r.shortName ?? '',
        roomGroupId: r.roomGroupId ?? '',
        campus: r.campus ?? '',
        floor: r.floor ?? '',
        location: r.location ?? '',
        cleanLevel: r.cleanLevel ?? '',
        stationCapacity: r.stationCapacity,
        emergencyCapable: r.emergencyCapable,
        negativePressure: r.negativePressure,
        hybridRoom: r.hybridRoom,
        openTime: r.openTime ?? '',
        closeTime: r.closeTime ?? '',
        remark: r.remark ?? '',
        expectedVersion: r.version,
        roomId: r.roomId,
        capabilities: r.capabilities.map((c) => ({ ...c })),
      });
    } else {
      isCreate.value = true;
      Object.assign(form, blankForm());
    }
  },
  { immediate: true },
);

async function onSave() {
  if (!form.roomCode.trim()) {
    Message.warning('手术间编码不能为空');
    return;
  }
  if (!form.roomName.trim()) {
    Message.warning('手术间名称不能为空');
    return;
  }
  saving.value = true;
  try {
    if (isCreate.value) {
      await createRoomConfiguration(toPayload());
      Message.success('创建成功');
    } else {
      await updateRoomConfiguration(toPayload());
      Message.success('更新成功');
    }
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

function toPayload(): Record<string, unknown> {
  const capabilities = form.capabilities
    .filter((c) => c.capabilityType && c.capabilityCode.trim())
    .map((c) => ({
      capabilityType: c.capabilityType,
      capabilityCode: c.capabilityCode.trim(),
      capabilityName: c.capabilityName || null,
    }));
  return {
    roomId: form.roomId,
    roomCode: form.roomCode.trim(),
    roomName: form.roomName.trim(),
    shortName: form.shortName || null,
    roomGroupId: form.roomGroupId || null,
    campus: form.campus || null,
    floor: form.floor || null,
    location: form.location || null,
    cleanLevel: form.cleanLevel || null,
    stationCapacity: form.stationCapacity,
    emergencyCapable: form.emergencyCapable,
    negativePressure: form.negativePressure,
    hybridRoom: form.hybridRoom,
    openTime: form.openTime || null,
    closeTime: form.closeTime || null,
    remark: form.remark || null,
    expectedVersion: form.expectedVersion,
    capabilities,
  };
}
</script>

<style scoped>
.cap-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}
</style>
