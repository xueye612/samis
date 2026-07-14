<template>
  <a-drawer
    :visible="visible"
    :width="600"
    :title="isCreate ? '新增麻醉方式' : '编辑麻醉方式'"
    :mask-closable="false"
    unmount-on-close
    @cancel="emit('cancel')"
  >
    <a-form :model="form" layout="vertical">
      <a-row :gutter="12">
        <a-col :span="12"><a-form-item label="编码" :required="true"><a-input v-model="form.itemCode" :disabled="!isCreate" /></a-form-item></a-col>
        <a-col :span="12"><a-form-item label="名称" :required="true"><a-input v-model="form.itemName" /></a-form-item></a-col>
      </a-row>
      <a-form-item label="所属大类" :required="true">
        <a-select v-model="form.parentCode" placeholder="选择真实大类" allow-clear :disabled="!isCreate && !!form.parentCode">
          <a-option v-for="cat in categories" :key="cat.categoryCode" :value="cat.categoryCode" :label="cat.categoryName" />
        </a-select>
      </a-form-item>
      <a-form-item label="适用手术类型"><a-textarea v-model="form.applicableOperationTypes" :auto-size="{ minRows: 2 }" /></a-form-item>
      <a-row :gutter="12">
        <a-col :span="12"><a-form-item label="默认模板编码"><a-input v-model="form.defaultTemplateCode" /></a-form-item></a-col>
        <a-col :span="12"><a-form-item label="排序"><a-input-number v-model="form.sortNo" :min="0" /></a-form-item></a-col>
      </a-row>
      <a-form-item label="用药方案"><a-textarea v-model="form.medicationPlan" :auto-size="{ minRows: 2 }" /></a-form-item>
      <a-form-item label="监测方案"><a-textarea v-model="form.monitoringPlan" :auto-size="{ minRows: 2 }" /></a-form-item>
      <a-row :gutter="12">
        <a-col :span="8"><a-form-item label="气道策略"><a-input v-model="form.airwayStrategy" /></a-form-item></a-col>
        <a-col :span="8"><a-form-item label="镇痛策略"><a-input v-model="form.analgesiaStrategy" /></a-form-item></a-col>
        <a-col :span="8"><a-form-item label="PACU去向"><a-input v-model="form.pacuDestination" /></a-form-item></a-col>
      </a-row>
      <a-form-item label="风险"><a-textarea v-model="form.risks" :auto-size="{ minRows: 2 }" /></a-form-item>
      <a-form-item label="禁忌"><a-textarea v-model="form.contraindications" :auto-size="{ minRows: 2 }" /></a-form-item>
      <a-form-item label="备注"><a-textarea v-model="form.remark" :auto-size="{ minRows: 2 }" /></a-form-item>
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
import { saveProfessionalItem, ProfessionalConflictError, METHOD_CATEGORY } from '@/services/configuration/professionalDictionaryService';
import type { ProfessionalDictItem, MethodProfile, MethodCategory } from '@/types/system';

interface MethodForm {
  id: number; itemCode: string; itemName: string; parentCode: string;
  applicableOperationTypes: string; defaultTemplateCode: string; sortNo: number;
  medicationPlan: string; monitoringPlan: string;
  airwayStrategy: string; analgesiaStrategy: string; pacuDestination: string;
  risks: string; contraindications: string; remark: string; expectedVersion: number;
}

const props = defineProps<{ visible: boolean; item: ProfessionalDictItem | null; categories: MethodCategory[] }>();
const emit = defineEmits<{ (e: 'cancel'): void; (e: 'saved'): void }>();

const isCreate = ref(true);
const saving = ref(false);
const form = reactive<MethodForm>(blank());

function blank(): MethodForm {
  return { id: 0, itemCode: '', itemName: '', parentCode: '', applicableOperationTypes: '', defaultTemplateCode: '', sortNo: 0, medicationPlan: '', monitoringPlan: '', airwayStrategy: '', analgesiaStrategy: '', pacuDestination: '', risks: '', contraindications: '', remark: '', expectedVersion: 1 };
}

watch(() => [props.visible, props.item] as const, ([visible]) => {
  if (!visible) return;
  const it = props.item;
  if (it) {
    isCreate.value = false;
    const p = (it.profile ?? {}) as Partial<MethodProfile>;
    Object.assign(form, {
      id: it.id, itemCode: it.itemCode, itemName: it.itemName, parentCode: it.parentCode ?? '',
      applicableOperationTypes: p.applicableOperationTypes ?? '', defaultTemplateCode: p.defaultTemplateCode ?? '',
      sortNo: it.sortNo, medicationPlan: p.medicationPlan ?? '', monitoringPlan: p.monitoringPlan ?? '',
      airwayStrategy: p.airwayStrategy ?? '', analgesiaStrategy: p.analgesiaStrategy ?? '', pacuDestination: p.pacuDestination ?? '',
      risks: p.risks ?? '', contraindications: p.contraindications ?? '', remark: it.remark ?? '', expectedVersion: it.version,
    });
  } else {
    isCreate.value = true;
    Object.assign(form, blank());
  }
}, { immediate: true });

async function onSave() {
  if (!form.itemCode.trim()) { Message.warning('编码不能为空'); return; }
  if (!form.itemName.trim()) { Message.warning('名称不能为空'); return; }
  if (!form.parentCode) { Message.warning('必须选择所属大类'); return; }
  saving.value = true;
  try {
    await saveProfessionalItem(toPayload());
    Message.success(isCreate.value ? '创建成功' : '更新成功');
    emit('saved');
  } catch (e) {
    if (e instanceof ProfessionalConflictError) Message.warning('数据已被其他人修改，请刷新后重试');
    else if (e instanceof Error) Message.error(e.message);
  } finally { saving.value = false; }
}

function toPayload(): Record<string, unknown> {
  return {
    id: form.id, categoryCode: METHOD_CATEGORY,
    itemCode: form.itemCode.trim(), itemName: form.itemName.trim(),
    parentCode: form.parentCode || null, sortNo: form.sortNo,
    applicableOperationTypes: form.applicableOperationTypes || null,
    defaultTemplateCode: form.defaultTemplateCode || null,
    medicationPlan: form.medicationPlan || null, monitoringPlan: form.monitoringPlan || null,
    airwayStrategy: form.airwayStrategy || null, analgesiaStrategy: form.analgesiaStrategy || null,
    pacuDestination: form.pacuDestination || null, risks: form.risks || null,
    contraindications: form.contraindications || null, remark: form.remark || null,
    expectedVersion: form.expectedVersion,
  };
}
</script>
