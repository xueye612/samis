<template>
  <a-drawer :visible="visible" :title="config.title" :width="520" unmount-on-close @cancel="emit('update:visible', false)">
    <a-descriptions v-if="caseItem" :column="1" bordered size="small" style="margin-bottom: 16px">
      <a-descriptions-item label="患者">{{ caseItem.patientName }}</a-descriptions-item>
      <a-descriptions-item label="手术">{{ caseItem.surgeryName }}</a-descriptions-item>
      <a-descriptions-item label="手术间">{{ caseItem.room }}</a-descriptions-item>
    </a-descriptions>
    <a-form :model="checks" layout="vertical">
      <a-form-item v-for="item in config.checklist" :key="item.key" :label="item.label">
        <a-checkbox v-model="checks[item.key]">{{ item.label }}</a-checkbox>
      </a-form-item>
      <a-form-item label="备注">
        <a-textarea v-model="remark" :auto-size="{ minRows: 2 }" />
      </a-form-item>
    </a-form>
    <template #footer>
      <a-space>
        <a-button @click="emit('update:visible', false)">取消</a-button>
        <a-button type="primary" :disabled="!allChecked" @click="confirm">确认</a-button>
      </a-space>
    </template>
  </a-drawer>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import type { SurgeryCase } from '@/types/anesthesia';
import type { WorkflowMilestoneKey } from '@/types/clinicalModules';
import { useAnesthesiaStore } from '@/stores/anesthesia';

const props = defineProps<{
  visible: boolean;
  milestone: WorkflowMilestoneKey;
  caseItem?: SurgeryCase;
}>();
const emit = defineEmits<{ 'update:visible': [boolean]; confirmed: [] }>();
const store = useAnesthesiaStore();
const remark = ref('');
const checks = reactive<Record<string, boolean>>({});

const milestoneConfig: Record<WorkflowMilestoneKey, { title: string; checklist: { key: string; label: string }[] }> = {
  surgeryStart: { title: '手术开始', checklist: [{ key: 'identity', label: '身份核对' }, { key: 'site', label: '手术部位核对' }, { key: 'consent', label: '知情同意已签' }] },
  roomIn: { title: '进入手术间', checklist: [{ key: 'identity', label: '身份核对' }, { key: 'site', label: '手术部位核对' }, { key: 'allergy', label: '过敏史核对' }, { key: 'fasting', label: '禁食禁饮核对' }] },
  anesthesiaStart: { title: '麻醉开始', checklist: [{ key: 'equipment', label: '设备检查' }, { key: 'drug', label: '药品检查' }, { key: 'monitor', label: '监护检查' }, { key: 'assessment', label: '患者评估' }] },
  surgeryEnd: { title: '手术结束', checklist: [{ key: 'result', label: '手术结果确认' }, { key: 'specimen', label: '标本处理' }, { key: 'wound', label: '伤口处理' }] },
  anesthesiaEnd: { title: '麻醉结束', checklist: [{ key: 'consciousness', label: '意识状态' }, { key: 'breathing', label: '呼吸功能' }, { key: 'circulation', label: '循环功能' }] },
  roomOut: { title: '出手术间', checklist: [{ key: 'vitals', label: '生命体征稳定' }, { key: 'tubes', label: '管道情况' }, { key: 'transfer', label: '转运准备完成' }] },
  orOut: { title: '出手术室', checklist: [{ key: 'instrument', label: '器械清点' }, { key: 'dressing', label: '敷料清点' }, { key: 'needle', label: '针头清点' }] },
  pacuIn: { title: '进恢复室', checklist: [{ key: 'identity', label: '身份核对' }, { key: 'site', label: '手术部位核对' }, { key: 'items', label: '物品核对' }, { key: 'tubes', label: '管道核对' }] },
};

const config = computed(() => milestoneConfig[props.milestone]);
const allChecked = computed(() => config.value.checklist.every((item) => checks[item.key]));

watch(
  () => [props.visible, props.milestone] as const,
  () => {
    config.value.checklist.forEach((item) => {
      checks[item.key] = false;
    });
    remark.value = '';
  },
);

const confirm = () => {
  if (!props.caseItem) return;
  store.confirmWorkflowMilestone(props.caseItem.id, props.milestone, { ...checks });
  Message.success(`${config.value.title}已确认`);
  emit('confirmed');
  emit('update:visible', false);
};
</script>
