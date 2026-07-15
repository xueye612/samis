<template>
  <ModulePageShell title="麻醉会诊" description="基于真实手术病例的会诊申请、计划、完成与取消">
    <template #toolbar><a-space><a-button :loading="loading" @click="reload">刷新</a-button><a-button v-if="canCreate" type="primary" @click="openCreate">新增会诊</a-button></a-space></template>
    <a-alert v-if="error" type="error" show-icon style="margin-bottom:12px">{{ error }} <a-button size="mini" type="text" @click="reload">重试</a-button></a-alert>
    <a-row :gutter="16">
      <a-col :span="14">
        <a-card class="section-card" :bordered="false" title="会诊列表">
          <a-table v-if="rows.length || loading" :data="rows" :loading="loading" :pagination="false" row-key="id" @row-click="(row) => selectedId = Number(row.id)">
            <template #columns>
              <a-table-column title="患者"><template #cell="{ record }">{{ record.operationCase?.patientName || '—' }}</template></a-table-column>
              <a-table-column title="申请科室" data-index="requestDept" />
              <a-table-column title="计划会诊" data-index="plannedAt" />
              <a-table-column title="会诊医师" data-index="consultant" />
              <a-table-column title="状态"><template #cell="{ record }"><a-tag :color="record.status === '已完成' ? 'green' : record.status === '已取消' ? 'red' : 'orangered'">{{ record.status }}</a-tag></template></a-table-column>
              <a-table-column title="操作" :width="110"><template #cell="{ record }"><a-button v-if="record.status === '待会诊' && canCreate" size="mini" type="text" @click.stop="openEdit(record)">编辑</a-button></template></a-table-column>
            </template>
          </a-table>
          <EmptyState v-else title="暂无会诊记录" description="请选择真实病例创建会诊" icon="IconUser" />
        </a-card>
      </a-col>
      <a-col :span="10">
        <a-card class="section-card" :bordered="false" title="会诊详情">
          <template v-if="selected">
            <OperationCaseSummary :case-data="selected.operationCase ?? null" />
            <a-descriptions :column="1" bordered size="small" style="margin-top:12px">
              <a-descriptions-item label="申请时间">{{ selected.requestedAt || '—' }}</a-descriptions-item>
              <a-descriptions-item label="计划时间">{{ selected.plannedAt || '—' }}</a-descriptions-item>
              <a-descriptions-item label="完成时间">{{ selected.submittedAt || '—' }}</a-descriptions-item>
              <a-descriptions-item label="取消时间">{{ selected.cancelledAt || '—' }}</a-descriptions-item>
              <a-descriptions-item label="会诊意见">{{ selected.opinion || '—' }}</a-descriptions-item>
            </a-descriptions>
            <a-space v-if="selected.status === '待会诊'" style="margin-top:12px">
              <a-button v-if="canSubmit" type="primary" @click="onSubmit">提交会诊</a-button>
              <a-button v-if="canCancel" status="danger" @click="openCancel">取消会诊</a-button>
            </a-space>
          </template>
          <EmptyState v-else title="选择会诊记录" description="点击左侧记录查看详情" icon="IconList" />
        </a-card>
      </a-col>
    </a-row>

    <a-modal :visible="formVisible" :title="editing ? '编辑会诊' : '新增会诊'" @cancel="formVisible=false" @ok="save">
      <a-form :model="form" layout="vertical">
        <a-form-item label="手术病例" required><a-select v-model="form.operationId" :disabled="!!editing" placeholder="选择真实病例"><a-option v-for="item in cases" :key="caseId(item)" :value="caseId(item)">{{ item.patientName }} · {{ item.plannedOperationName || item.operationName }} · {{ item.plannedStartTime || item.operationDate }}</a-option></a-select></a-form-item>
        <OperationCaseSummary v-if="formCase" :case-data="formCase" />
        <a-form-item label="申请科室"><a-input v-model="form.requestDept" /></a-form-item>
        <a-form-item label="申请内容"><a-textarea v-model="form.requestContent" /></a-form-item>
        <a-form-item label="计划会诊时间"><a-date-picker v-model="form.plannedAt" show-time value-format="YYYY-MM-DD HH:mm:ss" style="width:100%" /></a-form-item>
        <a-form-item label="会诊医师"><a-input v-model="form.consultant" /></a-form-item>
        <a-form-item label="会诊意见"><a-textarea v-model="form.opinion" /></a-form-item>
      </a-form>
    </a-modal>
    <a-modal :visible="cancelVisible" title="取消会诊" @cancel="cancelVisible=false" @ok="onCancel"><a-form-item label="取消原因" required><a-textarea v-model="cancelReason" /></a-form-item></a-modal>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import EmptyState from '@/components/shared/EmptyState.vue';
import OperationCaseSummary from '@/components/preoperative/OperationCaseSummary.vue';
import type { PreopConsultation } from '@/api/preoperative';
import type { OperationCase } from '@/services/anesthesia/adapters/operationInfoAdapter';
import { authApi } from '@/api/auth';
import { cancelConsultation, createConsultation, hasPreopPermission, loadConsultationList, loadOperationCases, submitConsultation, updateConsultation } from '@/services/preoperative/preoperativeFiveFlowsService';

const rows=ref<PreopConsultation[]>([]); const cases=ref<OperationCase[]>([]); const selectedId=ref(0); const loading=ref(false); const error=ref('');
const formVisible=ref(false); const editing=ref<PreopConsultation|null>(null); const cancelVisible=ref(false); const cancelReason=ref('');
const form=reactive({operationId:'',requestDept:'',requestContent:'',plannedAt:'',consultant:'',opinion:''});
const permissions=ref<string[]>([]);const canCreate=computed(()=>hasPreopPermission(permissions.value,'preop.consultation.create'));const canSubmit=computed(()=>hasPreopPermission(permissions.value,'preop.consultation.submit'));const canCancel=computed(()=>hasPreopPermission(permissions.value,'preop.consultation.cancel'));
const selected=computed(()=>rows.value.find(x=>x.id===selectedId.value)??null);
const caseId=(item:OperationCase)=>String(item.operationId??'');
const formCase=computed(()=>cases.value.find(x=>x.operationId===form.operationId)??null);
async function reload(){loading.value=true;error.value='';try{[rows.value,cases.value]=await Promise.all([loadConsultationList({pageSize:200}),loadOperationCases()]);if(!selectedId.value&&rows.value[0])selectedId.value=rows.value[0].id;}catch(e){error.value=e instanceof Error?e.message:'加载会诊失败';}finally{loading.value=false;}}
function reset(){Object.assign(form,{operationId:'',requestDept:'',requestContent:'',plannedAt:'',consultant:'',opinion:''});}
function openCreate(){editing.value=null;reset();formVisible.value=true;}
function openEdit(row:PreopConsultation){editing.value=row;Object.assign(form,{operationId:row.operationId,requestDept:row.requestDept??'',requestContent:row.requestContent??'',plannedAt:row.plannedAt??'',consultant:row.consultant??'',opinion:row.opinion??''});formVisible.value=true;}
async function save(){if(!form.operationId){Message.warning('请选择手术病例');return;}try{const params={requestDept:form.requestDept,requestContent:form.requestContent,plannedAt:form.plannedAt,consultant:form.consultant,opinion:form.opinion};const result=editing.value?await updateConsultation(editing.value,params):await createConsultation(form.operationId,params);selectedId.value=result.id;formVisible.value=false;await reload();Message.success('会诊已保存');}catch(e){Message.error(e instanceof Error?e.message:'保存失败');}}
async function onSubmit(){if(!selected.value)return;try{await submitConsultation(selected.value);await reload();Message.success('会诊已完成');}catch(e){Message.error(e instanceof Error?e.message:'提交失败');}}
function openCancel(){cancelReason.value='';cancelVisible.value=true;}
async function onCancel(){if(!selected.value||!cancelReason.value.trim()){Message.warning('请填写取消原因');return;}try{await cancelConsultation(selected.value,cancelReason.value.trim());cancelVisible.value=false;await reload();Message.success('会诊已取消');}catch(e){Message.error(e instanceof Error?e.message:'取消失败');}}
async function loadPermissions(){try{const result=await authApi.myPermissions();permissions.value=Array.isArray(result?.permissions)?result.permissions.map(String):[];}catch{permissions.value=[];}}
onMounted(()=>Promise.all([loadPermissions(),reload()]));
</script>
