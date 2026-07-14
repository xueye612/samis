<template>
  <a-drawer
    :visible="visible"
    :width="600"
    :title="isCreate ? '新增手术间' : '编辑手术间'"
    :mask-closable="false"
    unmount-on-close
    @cancel="emit('cancel')"
  >
    <a-form :model="form" layout="vertical">
      <a-form-item label="手术间编码" :required="isRequired('roomCode')">
        <a-input v-model="form.roomCode" placeholder="稳定业务编码，全局唯一" :disabled="!isCreate" />
      </a-form-item>
      <a-form-item label="手术间名称" :required="isRequired('roomName')">
        <a-input v-model="form.roomName" />
      </a-form-item>
      <a-row :gutter="12">
        <a-col :span="8"><a-form-item label="简称"><a-input v-model="form.shortName" /></a-form-item></a-col>
        <a-col :span="8"><a-form-item label="类型" :required="isRequired('roomType')"><a-input v-model="form.roomType" /></a-form-item></a-col>
        <a-col :span="8"><a-form-item label="排序"><a-input-number v-model="form.sortNo" :min="0" /></a-form-item></a-col>
      </a-row>
      <a-row :gutter="12">
        <a-col :span="12"><a-form-item label="所属手术部编码" :required="isRequired('roomGroupId')"><a-input v-model="form.roomGroupId" /></a-form-item></a-col>
        <a-col :span="12"><a-form-item label="所属手术部名称"><a-input v-model="form.roomGroupName" /></a-form-item></a-col>
      </a-row>
      <a-row :gutter="12">
        <a-col :span="8"><a-form-item label="院区" :required="isRequired('campus')"><a-input v-model="form.campus" /></a-form-item></a-col>
        <a-col :span="8"><a-form-item label="楼层"><a-input v-model="form.floor" /></a-form-item></a-col>
        <a-col :span="8"><a-form-item label="位置" :required="isRequired('location')"><a-input v-model="form.location" /></a-form-item></a-col>
      </a-row>
      <a-row :gutter="12">
        <a-col :span="8"><a-form-item label="洁净等级" :required="isRequired('cleanLevel')"><a-input v-model="form.cleanLevel" /></a-form-item></a-col>
        <a-col :span="8"><a-form-item label="台位数量" :required="isRequired('stationCapacity')"><a-input-number v-model="form.stationCapacity" :min="0" /></a-form-item></a-col>
        <a-col :span="8">
          <a-form-item label="能力开关">
            <a-space>
              <a-checkbox v-model="form.emergencyCapable">急诊</a-checkbox>
              <a-checkbox v-model="form.negativePressure">负压</a-checkbox>
              <a-checkbox v-model="form.hybridRoom">复合</a-checkbox>
            </a-space>
          </a-form-item>
        </a-col>
      </a-row>
      <a-row :gutter="12">
        <a-col :span="8"><a-form-item label="默认麻醉机" :required="isRequired('defaultAnesthesiaMachine')"><a-input v-model="form.defaultAnesthesiaMachine" /></a-form-item></a-col>
        <a-col :span="8"><a-form-item label="默认监护仪" :required="isRequired('defaultMonitor')"><a-input v-model="form.defaultMonitor" /></a-form-item></a-col>
        <a-col :span="8"><a-form-item label="默认工作站" :required="isRequired('defaultWorkstation')"><a-input v-model="form.defaultWorkstation" /></a-form-item></a-col>
      </a-row>
      <a-row :gutter="12">
        <a-col :span="8"><a-form-item label="开放时间" :required="isRequired('openTime')"><a-input v-model="form.openTime" placeholder="HH:mm" /></a-form-item></a-col>
        <a-col :span="8"><a-form-item label="关闭时间"><a-input v-model="form.closeTime" placeholder="HH:mm" /></a-form-item></a-col>
        <a-col :span="8"><a-form-item label="备注"><a-input v-model="form.remark" /></a-form-item></a-col>
      </a-row>
      <a-row :gutter="12">
        <a-col :span="12"><a-form-item label="排班偏好"><a-input v-model="form.schedulePreference" /></a-form-item></a-col>
        <a-col :span="12"><a-form-item label="人员偏好"><a-input v-model="form.staffPreference" /></a-form-item></a-col>
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

interface EditorForm {
  roomCode: string;
  roomName: string;
  shortName: string;
  roomType: string;
  roomGroupId: string;
  roomGroupName: string;
  campus: string;
  floor: string;
  location: string;
  cleanLevel: string;
  stationCapacity: number;
  emergencyCapable: boolean;
  negativePressure: boolean;
  hybridRoom: boolean;
  defaultAnesthesiaMachine: string;
  defaultMonitor: string;
  defaultWorkstation: string;
  openTime: string;
  closeTime: string;
  schedulePreference: string;
  staffPreference: string;
  sortNo: number;
  remark: string;
  expectedVersion: number;
  roomId: number;
  capabilities: EditorCapability[];
}

const props = defineProps<{ visible: boolean; room: RoomConfiguration | null; requiredFields?: string[] }>();
const emit = defineEmits<{
  (e: 'cancel'): void;
  (e: 'saved'): void;
}>();

const isCreate = ref(true);
const saving = ref(false);
const form = reactive<EditorForm>(blankForm());

function isRequired(code: string): boolean {
  return (props.requiredFields ?? ['roomCode', 'roomName']).includes(code);
}

const capabilityTypeOptions = [
  { label: '手术类型', value: 'operation_type' },
  { label: '麻醉方式', value: 'anesthesia_method' },
  { label: '设备', value: 'equipment' },
];

function blankForm(): EditorForm {
  return {
    roomCode: '',
    roomName: '',
    shortName: '',
    roomType: '',
    roomGroupId: '',
    roomGroupName: '',
    campus: '',
    floor: '',
    location: '',
    cleanLevel: '',
    stationCapacity: 0,
    emergencyCapable: false,
    negativePressure: false,
    hybridRoom: false,
    defaultAnesthesiaMachine: '',
    defaultMonitor: '',
    defaultWorkstation: '',
    openTime: '',
    closeTime: '',
    schedulePreference: '',
    staffPreference: '',
    sortNo: 0,
    remark: '',
    expectedVersion: 1,
    roomId: 0,
    capabilities: [],
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
        roomType: r.roomType ?? '',
        roomGroupId: r.roomGroupId ?? '',
        roomGroupName: r.roomGroupName ?? '',
        campus: r.campus ?? '',
        floor: r.floor ?? '',
        location: r.location ?? '',
        cleanLevel: r.cleanLevel ?? '',
        stationCapacity: r.stationCapacity,
        emergencyCapable: r.emergencyCapable,
        negativePressure: r.negativePressure,
        hybridRoom: r.hybridRoom,
        defaultAnesthesiaMachine: r.defaultAnesthesiaMachine ?? '',
        defaultMonitor: r.defaultMonitor ?? '',
        defaultWorkstation: r.defaultWorkstation ?? '',
        openTime: r.openTime ?? '',
        closeTime: r.closeTime ?? '',
        schedulePreference: r.schedulePreference ?? '',
        staffPreference: r.staffPreference ?? '',
        sortNo: r.sortNo,
        remark: r.remark ?? '',
        expectedVersion: r.version,
        roomId: r.roomId,
        capabilities: r.capabilities.map((c) => ({
          capabilityType: c.capabilityType,
          capabilityCode: c.capabilityCode,
          capabilityName: c.capabilityName ?? '',
        })),
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
  // 始终发送 capabilities（含空数组以清除）；空串保留以支持清除后端旧值。
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
    shortName: form.shortName,
    roomType: form.roomType,
    roomGroupId: form.roomGroupId,
    roomGroupName: form.roomGroupName,
    campus: form.campus,
    floor: form.floor,
    location: form.location,
    cleanLevel: form.cleanLevel,
    stationCapacity: form.stationCapacity,
    emergencyCapable: form.emergencyCapable,
    negativePressure: form.negativePressure,
    hybridRoom: form.hybridRoom,
    defaultAnesthesiaMachine: form.defaultAnesthesiaMachine,
    defaultMonitor: form.defaultMonitor,
    defaultWorkstation: form.defaultWorkstation,
    openTime: form.openTime,
    closeTime: form.closeTime,
    schedulePreference: form.schedulePreference,
    staffPreference: form.staffPreference,
    sortNo: form.sortNo,
    remark: form.remark,
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
