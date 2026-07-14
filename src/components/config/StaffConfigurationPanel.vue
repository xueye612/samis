<template>
  <a-drawer
    :visible="visible"
    :width="580"
    :title="isCreate ? '新增人员' : '编辑人员'"
    :mask-closable="false"
    unmount-on-close
    @cancel="emit('cancel')"
  >
    <a-form :model="form" layout="vertical">
      <a-row :gutter="12">
        <a-col :span="12"><a-form-item label="工号" :required="true"><a-input v-model="form.gh" :disabled="!isCreate" /></a-form-item></a-col>
        <a-col :span="12"><a-form-item label="姓名" :required="true"><a-input v-model="form.name" /></a-form-item></a-col>
      </a-row>
      <a-row :gutter="12">
        <a-col :span="8"><a-form-item label="职称"><a-input v-model="form.title" /></a-form-item></a-col>
        <a-col :span="8"><a-form-item label="角色"><a-input v-model="form.role" /></a-form-item></a-col>
        <a-col :span="8"><a-form-item label="专业组"><a-input v-model="form.professionalGroup" /></a-form-item></a-col>
      </a-row>
      <a-row :gutter="12">
        <a-col :span="8"><a-form-item label="科室编码"><a-input v-model="form.departmentCode" /></a-form-item></a-col>
        <a-col :span="8"><a-form-item label="科室名称"><a-input v-model="form.departmentName" /></a-form-item></a-col>
        <a-col :span="8"><a-form-item label="授权等级"><a-input v-model="form.authorizationLevel" /></a-form-item></a-col>
      </a-row>
      <a-row :gutter="12">
        <a-col :span="8"><a-form-item label="排班权重"><a-input-number v-model="form.schedulingWeight" :min="0" /></a-form-item></a-col>
        <a-col :span="8"><a-form-item label="排序"><a-input-number v-model="form.sortNo" :min="0" /></a-form-item></a-col>
        <a-col :span="8"><a-form-item label="有效期起"><a-input v-model="form.validFrom" placeholder="YYYY-MM-DD" /></a-form-item></a-col>
        <a-col :span="8"><a-form-item label="有效期止"><a-input v-model="form.validTo" placeholder="YYYY-MM-DD" /></a-form-item></a-col>
      </a-row>
      <a-form-item label="适用范围（执业范围/岗位/工作区）">
        <div v-for="(sc, idx) in form.scopes" :key="idx" class="scope-row">
          <a-select v-model="sc.scopeType" :style="{ width: '130px' }" :options="scopeTypeOptions" />
          <a-input v-model="sc.scopeCode" placeholder="编码" :style="{ flex: 1 }" />
          <a-input v-model="sc.scopeName" placeholder="名称（可选）" :style="{ flex: 1 }" />
          <a-button status="danger" @click="form.scopes.splice(idx, 1)">移除</a-button>
        </div>
        <a-button type="dashed" @click="addScope">新增范围</a-button>
      </a-form-item>
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
import { saveStaffConfig, ProfessionalConflictError } from '@/services/configuration/professionalDictionaryService';
import type { StaffProfile, StaffScope } from '@/types/system';

interface EditorScope { scopeType: string; scopeCode: string; scopeName: string }
interface EditorForm {
  id: number; gh: string; name: string; title: string; role: string;
  professionalGroup: string; departmentCode: string; departmentName: string;
  authorizationLevel: string; schedulingWeight: number; sortNo: number; validFrom: string; validTo: string;
  remark: string; expectedVersion: number; scopes: EditorScope[];
}

const props = defineProps<{ visible: boolean; staff: StaffProfile | null }>();
const emit = defineEmits<{ (e: 'cancel'): void; (e: 'saved'): void }>();

const isCreate = ref(true);
const saving = ref(false);
const form = reactive<EditorForm>(blank());
const scopeTypeOptions = [
  { label: '执业范围', value: 'practice' },
  { label: '岗位', value: 'duty_role' },
  { label: '工作区', value: 'work_area' },
];

function blank(): EditorForm {
  return { id: 0, gh: '', name: '', title: '', role: '麻醉医生', professionalGroup: '', departmentCode: '', departmentName: '', authorizationLevel: '', schedulingWeight: 1, sortNo: 0, validFrom: '', validTo: '', remark: '', expectedVersion: 1, scopes: [] };
}
function addScope() { form.scopes.push({ scopeType: 'practice', scopeCode: '', scopeName: '' }); }

watch(() => [props.visible, props.staff] as const, ([visible]) => {
  if (!visible) return;
  const s = props.staff;
  if (s) {
    isCreate.value = false;
    Object.assign(form, {
      id: s.id, gh: s.gh, name: s.name, title: s.title ?? '', role: s.role,
      professionalGroup: s.professionalGroup ?? '', departmentCode: s.departmentCode ?? '', departmentName: s.departmentName ?? '',
      authorizationLevel: s.authorizationLevel ?? '', schedulingWeight: s.schedulingWeight, sortNo: s.sortNo, validFrom: s.validFrom ?? '', validTo: s.validTo ?? '',
      remark: s.remark ?? '', expectedVersion: s.version,
      scopes: s.scopes.map((c) => ({ scopeType: c.scopeType, scopeCode: c.scopeCode, scopeName: c.scopeName ?? '' })),
    });
  } else {
    isCreate.value = true;
    Object.assign(form, blank());
  }
}, { immediate: true });

async function onSave() {
  if (!form.gh.trim()) { Message.warning('工号不能为空'); return; }
  if (!form.name.trim()) { Message.warning('姓名不能为空'); return; }
  saving.value = true;
  try {
    await saveStaffConfig(toPayload());
    Message.success(isCreate.value ? '创建成功' : '更新成功');
    emit('saved');
  } catch (e) {
    if (e instanceof ProfessionalConflictError) Message.warning('数据已被其他人修改，请刷新后重试');
    else if (e instanceof Error) Message.error(e.message);
  } finally {
    saving.value = false;
  }
}

function toPayload(): Record<string, unknown> {
  const scopes: StaffScope[] = form.scopes
    .filter((c) => c.scopeType && c.scopeCode.trim())
    .map((c) => ({ scopeType: c.scopeType as StaffScope['scopeType'], scopeCode: c.scopeCode.trim(), scopeName: c.scopeName || null }));
  return {
    id: form.id, gh: form.gh.trim(), name: form.name.trim(), title: form.title || null,
    role: form.role || '麻醉医生', professionalGroup: form.professionalGroup || null,
    departmentCode: form.departmentCode || null, departmentName: form.departmentName || null,
    authorizationLevel: form.authorizationLevel || null, schedulingWeight: form.schedulingWeight, sortNo: form.sortNo,
    validFrom: form.validFrom || null, validTo: form.validTo || null, remark: form.remark || null,
    expectedVersion: form.expectedVersion, scopes,
  };
}
</script>

<style scoped>
.scope-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
</style>
