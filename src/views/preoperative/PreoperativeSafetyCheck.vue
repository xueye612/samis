<template>
  <ModulePageShell title="手术安全核查" description="只读 HULI 护理原单；SAMIS 仅确认麻醉角色">
    <template #toolbar><a-space><a-select v-model="operationId" style="width:360px" placeholder="选择真实手术病例" @change="reload"><a-option v-for="item in cases" :key="caseId(item)" :value="caseId(item)">{{item.patientName}} · {{item.plannedOperationName||item.operationName}} · {{item.plannedStartTime||item.operationDate}}</a-option></a-select><a-button :loading="loading" @click="reload">刷新</a-button></a-space></template>
    <a-alert v-if="error" type="error" show-icon style="margin-bottom:12px">护理安全核查读取失败：{{error}} <a-button size="mini" type="text" @click="reload">重试</a-button></a-alert>
    <a-card v-if="caseData" class="section-card" :bordered="false" title="患者与手术信息"><OperationCaseSummary :case-data="caseData" /></a-card>
    <a-card v-if="summary" class="section-card" :bordered="false">
      <template #title>HULI 护理安全核查 <a-tag color="purple">来源：{{summary.source}}</a-tag> <a-tag>{{summary.status}}</a-tag></template>
      <a-alert v-if="summary.status==='missing'" type="warning" show-icon>护理系统尚无该手术的安全核查原单。</a-alert>
      <a-table v-else :data="summary.stages || []" :pagination="false" row-key="code">
        <template #columns>
          <a-table-column title="阶段"><template #cell="{record}">{{stageLabel(record.code)}}</template></a-table-column>
          <a-table-column title="手术医师"><template #cell="{record}">{{roleText(record.roles.surgeon)}}</template></a-table-column>
          <a-table-column title="麻醉医师"><template #cell="{record}"><a-tag :color="record.roles.anesthesiologist.confirmed?'green':'orangered'">{{roleText(record.roles.anesthesiologist)}}</a-tag></template></a-table-column>
          <a-table-column title="护士"><template #cell="{record}">{{roleText(record.roles.nurse)}}</template></a-table-column>
          <a-table-column title="护理核查内容" :width="260"><template #cell="{record}"><a-space wrap><a-tag v-for="item in checkedItems(record)" :key="item.code" :color="item.value?'orangered':'green'">{{item.label}}{{item.value?`：${item.value}`:''}}</a-tag><span v-if="!checkedItems(record).length">尚未填写</span></a-space></template></a-table-column>
          <a-table-column title="护理异常"><template #cell="{record}">{{record.exceptions?.length?record.exceptions.join('；'):'无'}}</template></a-table-column>
          <a-table-column title="麻醉确认"><template #cell="{record}"><a-button v-if="canConfirm" size="mini" type="primary" :loading="acting===record.code" @click="confirm(record.code,!record.roles.anesthesiologist.confirmed)">{{record.roles.anesthesiologist.confirmed?'撤销确认':'确认'}}</a-button><span v-else>无确认权限</span></template></a-table-column>
        </template>
      </a-table>
      <div style="margin-top:12px;color:var(--text-secondary)">护理原单更新时间：{{summary.updatedAt||'—'}}</div>
    </a-card>
    <EmptyState v-else-if="!loading&&!error" title="请选择手术病例" description="选择后直接读取 HULI 护理安全核查内容" icon="IconCheckCircle" />
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';import { Message } from '@arco-design/web-vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';import EmptyState from '@/components/shared/EmptyState.vue';import OperationCaseSummary from '@/components/preoperative/OperationCaseSummary.vue';
import type { PreopSafetyStage, PreopSafetySummary } from '@/api/preoperative';import type { OperationCase } from '@/services/anesthesia/adapters/operationInfoAdapter';
import { authApi } from '@/api/auth';import { confirmSafetyRole, hasPreopPermission, loadOperationCases, loadSafetySummary } from '@/services/preoperative/preoperativeFiveFlowsService';
const cases=ref<OperationCase[]>([]);const operationId=ref('');const summary=ref<PreopSafetySummary|null>(null);const loading=ref(false);const error=ref('');const acting=ref('');
const permissions=ref<string[]>([]);const canConfirm=computed(()=>hasPreopPermission(permissions.value,'preop.safety.confirm'));
const caseData=computed(()=>cases.value.find(x=>x.operationId===operationId.value)??null);
const caseId=(item:OperationCase)=>String(item.operationId??'');
const stageLabel=(code:string)=>({sign_in:'Sign In · 麻醉诱导前',time_out:'Time Out · 切皮前',sign_out:'Sign Out · 离室前'}[code]??code);
const roleText=(role:{confirmed:boolean;staffGh:string|null;confirmedAt:string|null})=>role.confirmed?`已确认 · ${role.staffGh||'—'} · ${role.confirmedAt||'—'}`:'未确认';
const checkedItems=(stage:PreopSafetyStage)=>stage.items?.filter((item)=>item.checked)||[];
async function reload(){if(!operationId.value){summary.value=null;return;}loading.value=true;error.value='';try{summary.value=await loadSafetySummary(operationId.value);}catch(e){summary.value=null;error.value=e instanceof Error?e.message:'未知错误';}finally{loading.value=false;}}
async function confirm(stage:string,confirmed:boolean){if(!operationId.value)return;acting.value=stage;try{summary.value=await confirmSafetyRole(operationId.value,stage,confirmed,confirmed?'麻醉角色确认':'撤销麻醉角色确认');await reload();Message.success('麻醉角色确认已保存');}catch(e){Message.error(e instanceof Error?e.message:'确认失败');}finally{acting.value='';}}
async function loadPermissions(){try{const result=await authApi.myPermissions();permissions.value=Array.isArray(result?.permissions)?result.permissions.map(String):[];}catch{permissions.value=[];}}
onMounted(async()=>{await loadPermissions();try{cases.value=await loadOperationCases();if(cases.value[0]){operationId.value=caseId(cases.value[0]);await reload();}}catch(e){error.value=e instanceof Error?e.message:'加载病例失败';}});
</script>

<style scoped>
:deep(.section-card .arco-card-header) { min-height: 44px; }
:deep(.arco-table-cell) { font-size: var(--font-size-sm); }
</style>
