<template>
  <ModulePageShell title="术前检查审核" description="区分 HULI、LIS、PACS 与人工录入来源">
    <template #toolbar><a-space><a-button :loading="loading" @click="reload">刷新</a-button><a-button v-if="canManage" type="primary" @click="openCreate">新增审核</a-button></a-space></template>
    <a-alert v-if="error" type="error" show-icon style="margin-bottom:12px">{{ error }} <a-button size="mini" type="text" @click="reload">重试</a-button></a-alert>
    <a-card class="section-card" :bordered="false" title="检查审核列表">
      <a-table v-if="rows.length || loading" :data="rows" :loading="loading" :pagination="{pageSize:8}" row-key="id">
        <template #columns>
          <a-table-column title="患者"><template #cell="{record}">{{ record.operationCase?.patientName || '—' }}</template></a-table-column>
          <a-table-column title="来源"><template #cell="{record}"><a-space wrap><a-tag v-for="item in record.items" :key="item.id || item.itemId" :color="item.sourceType === 'manual' ? 'arcoblue' : 'purple'">{{ item.sourceType }}</a-tag></a-space></template></a-table-column>
          <a-table-column title="检查项目"><template #cell="{record}">{{ itemNames(record) }}</template></a-table-column>
          <a-table-column title="审核结果"><template #cell="{record}"><a-tag :color="record.reviewResult==='通过'?'green':record.reviewResult==='异常'?'red':'orangered'">{{record.reviewResult}}</a-tag></template></a-table-column>
          <a-table-column title="审核人" data-index="reviewer" />
          <a-table-column title="审核时间" data-index="reviewedAt" />
          <a-table-column title="操作"><template #cell="{record}"><a-button v-if="allManual(record)&&canManage" size="mini" type="text" @click="openEdit(record)">编辑人工项</a-button><span v-else>外部只读</span></template></a-table-column>
        </template>
      </a-table>
      <EmptyState v-else title="暂无检查审核" description="真实空列表不会回填模拟检查" icon="IconFile" />
    </a-card>

    <a-modal :visible="visible" :title="editing?'编辑人工检查':'新增检查审核'" :width="680" @cancel="visible=false" @ok="save">
      <a-form :model="form" layout="vertical">
        <a-form-item label="手术病例" required><a-select v-model="form.operationId" :disabled="!!editing"><a-option v-for="item in cases" :key="caseId(item)" :value="caseId(item)">{{item.patientName}} · {{item.plannedOperationName || item.operationName}} · {{item.plannedStartTime || item.operationDate}}</a-option></a-select></a-form-item>
        <OperationCaseSummary v-if="formCase" :case-data="formCase" />
        <a-row :gutter="12" style="margin-top:12px">
          <a-col :span="8"><a-form-item label="来源"><a-select v-model="form.sourceType" :disabled="!!editing"><a-option value="HULI">HULI</a-option><a-option value="LIS">LIS</a-option><a-option value="PACS">PACS</a-option><a-option value="manual">人工</a-option></a-select></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="项目编码"><a-input v-model="form.itemCode" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="项目名称"><a-input v-model="form.itemName" /></a-form-item></a-col>
        </a-row>
        <a-row :gutter="12"><a-col :span="12"><a-form-item label="结果"><a-input v-model="form.resultValue" /></a-form-item></a-col><a-col :span="12"><a-form-item label="单位"><a-input v-model="form.resultUnit" /></a-form-item></a-col></a-row>
        <a-form-item v-if="form.sourceType!=='manual'" label="外部引用" required><a-input v-model="form.sourceRef" /></a-form-item>
        <a-row v-else :gutter="12"><a-col :span="12"><a-form-item label="录入人" required><a-input v-model="form.recordedBy" /></a-form-item></a-col><a-col :span="12"><a-form-item label="录入时间" required><a-date-picker v-model="form.recordedAt" show-time value-format="YYYY-MM-DD HH:mm:ss" style="width:100%" /></a-form-item></a-col></a-row>
        <a-row :gutter="12"><a-col :span="12"><a-form-item label="审核结果"><a-select v-model="form.reviewResult"><a-option value="通过">通过</a-option><a-option value="待补检">待补检</a-option><a-option value="异常">异常</a-option></a-select></a-form-item></a-col><a-col :span="12"><a-form-item label="审核人"><a-input v-model="form.reviewer" /></a-form-item></a-col></a-row>
      </a-form>
    </a-modal>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue'; import EmptyState from '@/components/shared/EmptyState.vue'; import OperationCaseSummary from '@/components/preoperative/OperationCaseSummary.vue';
import type { PreopExamReview, PreopExamSource } from '@/api/preoperative'; import type { OperationCase } from '@/services/anesthesia/adapters/operationInfoAdapter';
import { authApi } from '@/api/auth';import { createExamReview, hasPreopPermission, loadExamReviewList, loadOperationCases, updateExamReview } from '@/services/preoperative/preoperativeFiveFlowsService';
const rows=ref<PreopExamReview[]>([]);const cases=ref<OperationCase[]>([]);const loading=ref(false);const error=ref('');const visible=ref(false);const editing=ref<PreopExamReview|null>(null);
const form=reactive({operationId:'',sourceType:'manual' as PreopExamSource,itemCode:'',itemName:'',resultValue:'',resultUnit:'',sourceRef:'',recordedBy:'',recordedAt:'',reviewResult:'通过' as PreopExamReview['reviewResult'],reviewer:''});
const permissions=ref<string[]>([]);const canManage=computed(()=>hasPreopPermission(permissions.value,'preop.exam.manage'));
const formCase=computed(()=>cases.value.find(x=>x.operationId===form.operationId)??null);
const caseId=(item:OperationCase)=>String(item.operationId??'');
const itemNames=(row:PreopExamReview)=>row.items.map((item)=>item.itemName).join('、')||'—';
const allManual=(row:PreopExamReview)=>row.items.every((item)=>item.sourceType==='manual');
async function reload(){loading.value=true;error.value='';try{[rows.value,cases.value]=await Promise.all([loadExamReviewList({pageSize:200}),loadOperationCases()]);}catch(e){rows.value=[];error.value=e instanceof Error?e.message:'加载检查审核失败';}finally{loading.value=false;}}
function reset(){Object.assign(form,{operationId:'',sourceType:'manual',itemCode:'',itemName:'',resultValue:'',resultUnit:'',sourceRef:'',recordedBy:'',recordedAt:'',reviewResult:'通过',reviewer:''});}
function openCreate(){editing.value=null;reset();visible.value=true;}
function openEdit(row:PreopExamReview){const item=row.items[0];if(!item||item.sourceType!=='manual')return;editing.value=row;Object.assign(form,{operationId:row.operationId,sourceType:item.sourceType,itemCode:item.itemCode,itemName:item.itemName,resultValue:item.resultValue??'',resultUnit:item.resultUnit??'',sourceRef:item.sourceRef??'',recordedBy:item.recordedBy??'',recordedAt:item.recordedAt??'',reviewResult:row.reviewResult,reviewer:row.reviewer??''});visible.value=true;}
async function save(){if(!form.operationId||!form.itemCode||!form.itemName){Message.warning('请选择病例并填写检查项目');return;}if(form.sourceType==='manual'&&(!form.recordedBy||!form.recordedAt)){Message.warning('人工项必须填写录入人和录入时间');return;}if(form.sourceType!=='manual'&&!form.sourceRef){Message.warning('外部项必须填写来源引用');return;}const old=editing.value?.items[0];const item={id:old?.id,itemId:old?.itemId,version:old?.version,sourceType:form.sourceType,sourceSystem:form.sourceType==='manual'?'SAMIS':form.sourceType,sourceRef:form.sourceType==='manual'?null:form.sourceRef,recordedBy:form.sourceType==='manual'?form.recordedBy:null,recordedAt:form.sourceType==='manual'?form.recordedAt:null,examType:form.sourceType==='PACS'?'imaging':'lab',itemCode:form.itemCode,itemName:form.itemName,resultValue:form.resultValue,resultUnit:form.resultUnit};try{const params={reviewResult:form.reviewResult,reviewer:form.reviewer,items:[item]};editing.value?await updateExamReview(editing.value,params):await createExamReview(form.operationId,params);visible.value=false;await reload();Message.success('检查审核已保存');}catch(e){Message.error(e instanceof Error?e.message:'保存失败');}}
async function loadPermissions(){try{const result=await authApi.myPermissions();permissions.value=Array.isArray(result?.permissions)?result.permissions.map(String):[];}catch{permissions.value=[];}}
onMounted(()=>Promise.all([loadPermissions(),reload()]));
</script>

<style scoped>
:deep(.section-card .arco-card-header) { min-height: 44px; }
:deep(.arco-table-cell) { font-size: var(--font-size-sm); }
</style>
