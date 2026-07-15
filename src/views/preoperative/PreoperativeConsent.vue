<template>
  <ModulePageShell title="知情同意" description="患者与手术信息来自 HULI，SAMIS 仅保存同意流程">
    <template #toolbar><a-space><a-select v-model="operationId" style="width:360px" placeholder="选择真实手术病例" @change="loadConsent"><a-option v-for="item in cases" :key="caseId(item)" :value="caseId(item)">{{item.patientName}} · {{item.plannedOperationName || item.operationName}} · {{item.plannedStartTime || item.operationDate}}</a-option></a-select><a-button :loading="loading" @click="reloadCases">刷新</a-button></a-space></template>
    <a-alert v-if="error" type="error" show-icon style="margin-bottom:12px">{{error}} <a-button size="mini" type="text" @click="loadConsent">重试</a-button></a-alert>
    <a-card v-if="caseData" class="section-card" :bordered="false" title="患者与手术信息"><OperationCaseSummary :case-data="caseData" /></a-card>
    <a-card v-if="record" class="section-card" :bordered="false">
      <template #title>知情同意 <a-tag style="margin-left:8px">{{record.status}}</a-tag> <a-tag>版本 {{record.version}}</a-tag></template>
      <a-form :model="form" layout="vertical">
        <a-row :gutter="12"><a-col :span="8"><a-form-item label="模板编码"><a-input v-model="form.templateCode" :disabled="readonly" /></a-form-item></a-col><a-col :span="8"><a-form-item label="模板版本"><a-input v-model="form.templateVersion" :disabled="readonly" /></a-form-item></a-col><a-col :span="8"><a-form-item label="麻醉方式"><a-input v-model="form.anesthesiaMethod" :disabled="readonly" /></a-form-item></a-col></a-row>
        <a-form-item label="风险说明"><a-textarea v-model="form.riskDisclosure" :disabled="readonly" :auto-size="{minRows:4}" /></a-form-item>
        <a-space wrap><a-checkbox v-model="form.commonRisks" :disabled="readonly">常见风险已告知</a-checkbox><a-checkbox v-model="form.severeRisks" :disabled="readonly">严重风险已告知</a-checkbox><a-checkbox v-model="form.specialRisks" :disabled="readonly">特殊风险已告知</a-checkbox><a-checkbox v-model="form.planAccepted" :disabled="readonly">接受方案</a-checkbox><a-checkbox v-model="form.questionAnswered" :disabled="readonly">疑问已解答</a-checkbox></a-space>
      </a-form>
      <a-descriptions :column="3" bordered size="small" style="margin-top:16px"><a-descriptions-item label="签署时间">{{record.signedAt||'—'}}</a-descriptions-item><a-descriptions-item label="撤回时间">{{record.withdrawnAt||'—'}}</a-descriptions-item><a-descriptions-item label="打印时间">{{record.printedAt||'—'}}</a-descriptions-item><a-descriptions-item label="归档时间">{{record.archivedAt||'—'}}</a-descriptions-item><a-descriptions-item label="打印状态">{{record.printStatus}}</a-descriptions-item><a-descriptions-item label="归档状态">{{record.archiveStatus}}</a-descriptions-item></a-descriptions>
      <a-alert v-if="record.status==='待签署'" type="info" style="margin-top:12px">正文已冻结；患者/代理人手写签名和医生 CA 签名须在签署终端完成后才能提交。</a-alert>
      <a-space style="margin-top:16px" wrap>
        <a-button v-if="!readonly&&canCreate" :loading="saving" @click="saveDraft">保存草稿</a-button>
        <a-button v-if="record.status==='草稿'&&canSign" type="primary" @click="prepareSigning">准备签署</a-button>
        <a-button v-if="record.status==='待签署'&&canSubmit" type="primary" @click="submit">提交</a-button>
        <a-button v-if="record.status==='已提交'&&canWithdraw" @click="withdraw">撤回</a-button>
        <a-button v-if="record.status==='已提交'&&record.printStatus!=='已打印'&&canSubmit" @click="markPrinted">记录打印</a-button>
        <a-button v-if="record.status==='已提交'&&record.archiveStatus!=='已归档'&&canArchive" status="warning" @click="archive">归档</a-button>
      </a-space>
    </a-card>
    <a-card v-else-if="caseData&&!loading" class="section-card" :bordered="false"><EmptyState title="尚无知情同意书" description="为当前真实病例创建草稿" icon="IconFile" /><div v-if="canCreate" style="text-align:center"><a-button type="primary" @click="createDraft">创建草稿</a-button></div></a-card>
    <EmptyState v-else-if="!caseData&&!loading" title="请选择手术病例" description="选择病例后加载患者、诊断、手术和计划日期" icon="IconUser" />
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'; import { Message } from '@arco-design/web-vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue'; import EmptyState from '@/components/shared/EmptyState.vue'; import OperationCaseSummary from '@/components/preoperative/OperationCaseSummary.vue';
import type { PreopConsent } from '@/api/preoperative'; import type { OperationCase } from '@/services/anesthesia/adapters/operationInfoAdapter';
import { authApi } from '@/api/auth';import { archiveConsent, createConsent, hasPreopPermission, loadConsentByCaseId, loadOperationCases, markConsentPrinted, prepareConsentSigning, submitConsent, updateConsent, withdrawConsent } from '@/services/preoperative/preoperativeFiveFlowsService';
const cases=ref<OperationCase[]>([]);const operationId=ref('');const record=ref<PreopConsent|null>(null);const loading=ref(false);const saving=ref(false);const error=ref('');
const form=reactive({templateCode:'',templateVersion:'',anesthesiaMethod:'',riskDisclosure:'',commonRisks:false,severeRisks:false,specialRisks:false,planAccepted:false,questionAnswered:false});
const permissions=ref<string[]>([]);const canCreate=computed(()=>hasPreopPermission(permissions.value,'preop.consent.create'));const canSign=computed(()=>hasPreopPermission(permissions.value,'preop.consent.sign'));const canSubmit=computed(()=>hasPreopPermission(permissions.value,'preop.consent.submit'));const canWithdraw=computed(()=>hasPreopPermission(permissions.value,'preop.consent.withdraw'));const canArchive=computed(()=>hasPreopPermission(permissions.value,'preop.consent.archive'));
const caseData=computed(()=>cases.value.find(x=>x.operationId===operationId.value)??record.value?.operationCase??null);const readonly=computed(()=>record.value?.status==='已提交'||record.value?.archiveStatus==='已归档');
const caseId=(item:OperationCase)=>String(item.operationId??'');
function sync(){if(!record.value)return;Object.assign(form,{templateCode:record.value.templateCode??'',templateVersion:record.value.templateVersion??'',anesthesiaMethod:record.value.anesthesiaMethod??'',riskDisclosure:record.value.riskDisclosure??'',commonRisks:record.value.commonRisks,severeRisks:record.value.severeRisks,specialRisks:record.value.specialRisks,planAccepted:record.value.planAccepted,questionAnswered:record.value.questionAnswered});}
async function reloadCases(){loading.value=true;error.value='';try{cases.value=await loadOperationCases();if(!operationId.value&&cases.value[0]){operationId.value=caseId(cases.value[0]);await loadConsent();}}catch(e){error.value=e instanceof Error?e.message:'加载病例失败';}finally{loading.value=false;}}
async function loadConsent(){if(!operationId.value){record.value=null;return;}loading.value=true;error.value='';try{record.value=await loadConsentByCaseId(operationId.value);sync();}catch(e){record.value=null;error.value=e instanceof Error?e.message:'加载知情同意失败';}finally{loading.value=false;}}
const payload=()=>({...form});
async function createDraft(){if(!operationId.value)return;try{record.value=await createConsent(operationId.value,payload());sync();Message.success('草稿已创建');}catch(e){Message.error(e instanceof Error?e.message:'创建失败');}}
async function saveDraft(){if(!record.value)return;saving.value=true;try{record.value=await updateConsent(record.value,payload());sync();Message.success('草稿已保存');}catch(e){Message.error(e instanceof Error?e.message:'保存失败');}finally{saving.value=false;}}
async function prepareSigning(){if(!record.value)return;try{if(record.value.status==='草稿')record.value=await updateConsent(record.value,payload());record.value=await prepareConsentSigning(record.value);sync();Message.success('已准备签署');}catch(e){Message.error(e instanceof Error?e.message:'准备签署失败');}}
async function submit(){if(!record.value)return;try{record.value=await submitConsent(record.value);sync();Message.success('已提交');}catch(e){Message.error(e instanceof Error?e.message:'提交失败');}}
async function withdraw(){if(!record.value)return;try{record.value=await withdrawConsent(record.value,'重新修订');sync();Message.success('已撤回');}catch(e){Message.error(e instanceof Error?e.message:'撤回失败');}}
async function markPrinted(){if(!record.value)return;try{record.value=await markConsentPrinted(record.value);sync();Message.success('打印状态已记录');}catch(e){Message.error(e instanceof Error?e.message:'记录失败');}}
async function archive(){if(!record.value)return;try{record.value=await archiveConsent(record.value);sync();Message.success('已归档');}catch(e){Message.error(e instanceof Error?e.message:'归档失败');}}
async function loadPermissions(){try{const result=await authApi.myPermissions();permissions.value=Array.isArray(result?.permissions)?result.permissions.map(String):[];}catch{permissions.value=[];}}
onMounted(()=>Promise.all([loadPermissions(),reloadCases()]));
</script>

<style scoped>
:deep(.section-card .arco-card-header) { min-height: 44px; }
:deep(.arco-table-cell) { font-size: var(--font-size-sm); }
</style>
