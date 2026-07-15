<template>
  <ModulePageShell title="术前访视/麻醉评估" description="病例主数据来自 HULI；评估按服务端版本保存、提交和修订">
    <template #chips><a-tag :color="assessment.status==='submitted'?'green':'orange'">{{ statusText }} · v{{ assessment.version }}</a-tag><a-tag :color="persistenceAvailable?'arcoblue':'red'">{{ persistenceAvailable?'真实存储':'存储不可用' }}</a-tag></template>
    <template #toolbar>
      <a-space wrap>
        <a-select v-model="selectedId" style="width:360px" placeholder="选择真实手术病例"><a-option v-for="item in cases" :key="item.operationId||''" :value="item.operationId||''">{{ item.roomName||'未排房' }} · {{ item.patientName||'未提供姓名' }} · {{ item.operationName||'未提供手术' }}</a-option></a-select>
        <a-input v-model="actionReason" style="width:220px" placeholder="撤回/修订原因" allow-clear />
        <a-button :loading="saving" :disabled="!canEdit" @click="saveDraft">保存草稿</a-button>
        <a-button type="primary" :loading="saving" :disabled="!canSubmit" @click="submitAssessment">提交评估</a-button>
        <a-button :loading="saving" :disabled="!canWithdraw" @click="withdrawAssessment">撤回</a-button>
        <a-button :loading="saving" :disabled="!canWithdraw" @click="createRevision">创建修订</a-button>
      </a-space>
    </template>
    <a-alert v-if="errorMessage" type="error" show-icon>{{ errorMessage }} <a-button size="mini" type="text" @click="loadDetail(selectedId)">重试</a-button></a-alert>
    <a-alert v-else-if="!persistenceAvailable" type="warning" show-icon>真实评估存储不可用，写入已禁用。</a-alert>
    <EmptyState v-if="!selectedId && !loading" title="暂无真实手术病例" description="未从手术申请读取到 OperationCase，不使用模拟患者补位" icon="IconUser" />
    <a-spin v-else :loading="loading" style="width:100%">
      <a-card v-if="selectedId" class="section-card" :bordered="false" title="患者与手术真值">
        <a-descriptions :column="4" bordered>
          <a-descriptions-item label="患者">{{ operationCase.patientName||'—' }}</a-descriptions-item><a-descriptions-item label="性别/年龄">{{ operationCase.gender||'—' }} / {{ operationCase.age??'—' }}</a-descriptions-item>
          <a-descriptions-item label="科室">{{ operationCase.departmentName||'—' }}</a-descriptions-item><a-descriptions-item label="计划时间">{{ operationCase.plannedStartTime||'—' }}</a-descriptions-item>
          <a-descriptions-item label="术前诊断" :span="2">{{ operationCase.preoperativeDiagnosisName||'—' }}</a-descriptions-item><a-descriptions-item label="拟行手术" :span="2">{{ operationCase.operationName||'—' }}</a-descriptions-item>
        </a-descriptions>
      </a-card>
      <a-tabs v-if="selectedId" default-active-key="history">
        <a-tab-pane key="history" title="病史与系统评估">
          <a-card class="section-card" :bordered="false"><a-form :model="assessment" layout="vertical" :disabled="!canEdit"><a-row :gutter="16">
            <a-col :span="8"><a-form-item label="ASA 分级"><a-select v-model="textForm.asaGrade" allow-clear :options="['I','II','III','IV','V','VI']" /></a-form-item></a-col>
            <a-col :span="8"><a-form-item label="风险等级"><a-select v-model="textForm.riskLevel" allow-clear :options="[{label:'低',value:'low'},{label:'中',value:'moderate'},{label:'高',value:'high'}]" /></a-form-item></a-col>
            <a-col :span="8"><a-form-item label="评估医师（服务端）"><a-input :model-value="assessment.evaluatorName||''" disabled /></a-form-item></a-col>
            <a-col :span="12"><a-form-item label="现病史/既往病史（每行一项）"><a-textarea v-model="medicalHistoryText" :auto-size="{minRows:4}" /></a-form-item></a-col>
            <a-col :span="12"><a-form-item label="手术史（每行一项）"><a-textarea v-model="surgicalHistoryText" :auto-size="{minRows:4}" /></a-form-item></a-col>
            <a-col :span="12"><a-form-item label="长期用药（每行一项）"><a-textarea v-model="medicationHistoryText" :auto-size="{minRows:4}" /></a-form-item></a-col>
            <a-col :span="12"><a-form-item label="系统评估摘要"><a-textarea v-model="systemAssessmentText" :auto-size="{minRows:4}" /></a-form-item></a-col>
            <a-col :span="12"><a-form-item label="过敏史"><a-textarea v-model="textForm.allergyHistory" :auto-size="{minRows:2}" /></a-form-item></a-col><a-col :span="12"><a-form-item label="既往麻醉史"><a-textarea v-model="textForm.pastAnesthesiaHistory" :auto-size="{minRows:2}" /></a-form-item></a-col>
          </a-row></a-form></a-card>
        </a-tab-pane>
        <a-tab-pane key="airway" title="气道、牙齿与禁食">
          <a-card class="section-card" :bordered="false"><a-form :model="structured" layout="vertical" :disabled="!canEdit"><a-row :gutter="16">
            <a-col :span="6"><a-form-item label="Mallampati"><a-select v-model="structured.mallampati" allow-clear :options="['I','II','III','IV']" /></a-form-item></a-col><a-col :span="6"><a-form-item label="张口度(cm)"><a-input-number v-model="structured.mouthOpeningCm" :min="0" /></a-form-item></a-col>
            <a-col :span="6"><a-form-item label="固体禁食(h)"><a-input-number v-model="structured.solidHours" :min="0" /></a-form-item></a-col><a-col :span="6"><a-form-item label="清液禁饮(h)"><a-input-number v-model="structured.clearFluidHours" :min="0" /></a-form-item></a-col>
            <a-col :span="12"><a-form-item label="气道综合描述"><a-textarea v-model="textForm.airwayAssessment" :auto-size="{minRows:3}" /></a-form-item></a-col><a-col :span="12"><a-form-item label="牙齿情况"><a-textarea v-model="structured.dentitionSummary" :auto-size="{minRows:3}" /></a-form-item></a-col>
          </a-row></a-form></a-card>
        </a-tab-pane>
        <a-tab-pane key="risk" title="异常、风险与建议"><a-card class="section-card" :bordered="false"><a-form :model="assessment" layout="vertical" :disabled="!canEdit"><a-row :gutter="16">
          <a-col :span="12"><a-form-item label="异常检查（每行一项）"><a-textarea v-model="examText" :auto-size="{minRows:4}" /></a-form-item></a-col><a-col :span="12"><a-form-item label="风险因素（每行一项）"><a-textarea v-model="riskText" :auto-size="{minRows:4}" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="处置建议（每行一项）"><a-textarea v-model="recommendationText" :auto-size="{minRows:4}" /></a-form-item></a-col><a-col :span="12"><a-form-item label="术前用药建议"><a-textarea v-model="textForm.preMedicationAdvice" :auto-size="{minRows:4}" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="风险摘要"><a-textarea v-model="textForm.riskSummary" /></a-form-item></a-col><a-col :span="12"><a-form-item label="异常摘要"><a-textarea v-model="textForm.abnormalExamSummary" /></a-form-item></a-col>
        </a-row></a-form></a-card></a-tab-pane>
        <a-tab-pane key="historyVersions" title="提交历史"><a-card class="section-card" :bordered="false"><a-table :data="history" :pagination="false"><template #columns><a-table-column title="版本" data-index="version"/><a-table-column title="提交时间" data-index="submittedAt"/><a-table-column title="提交人" data-index="submittedBy"/><a-table-column title="修订原因" data-index="revisionReason"/></template></a-table><EmptyState v-if="!history.length" title="暂无已提交版本" description="提交评估后生成不可变历史" icon="IconClockCircle" /></a-card></a-tab-pane>
      </a-tabs>
    </a-spin>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed,onMounted,reactive,ref,watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import { authApi } from '@/api/auth';
import type { PreoperativeAssessmentApi,PreoperativeAssessmentDetailApi } from '@/api/preoperative';
import ModulePageShell from '@/components/shared/ModulePageShell.vue'; import EmptyState from '@/components/shared/EmptyState.vue';
import type { OperationCase } from '@/services/anesthesia/adapters/operationInfoAdapter';
import { cancelPreoperativeAssessmentSubmit,createPreoperativeAssessmentRevision,emptyPreoperativeAssessment,loadPreoperativeAssessment,savePreoperativeAssessmentDraft,submitPreoperativeAssessment } from '@/services/anesthesia/preoperativeAssessmentService';
import { hasPreopPermission,loadOperationCases } from '@/services/preoperative/preoperativeFiveFlowsService';
const cases=ref<OperationCase[]>([]); const selectedId=ref(''); const operationCase=reactive<OperationCase>({}); const assessment=reactive<PreoperativeAssessmentApi>(emptyPreoperativeAssessment(''));
const history=ref<PreoperativeAssessmentDetailApi['history']>([]); const permissions=ref<string[]>([]); const loading=ref(false); const saving=ref(false); const persistenceAvailable=ref(true); const errorMessage=ref(''); const actionReason=ref('');
const medicalHistoryText=ref('');const surgicalHistoryText=ref('');const medicationHistoryText=ref('');const systemAssessmentText=ref('');const examText=ref('');const riskText=ref('');const recommendationText=ref('');
const structured=reactive({mallampati:'',mouthOpeningCm:undefined as number|undefined,solidHours:undefined as number|undefined,clearFluidHours:undefined as number|undefined,dentitionSummary:''});
const textForm=reactive({asaGrade:'',riskLevel:'',allergyHistory:'',pastAnesthesiaHistory:'',airwayAssessment:'',preMedicationAdvice:'',riskSummary:'',abnormalExamSummary:''});
const has=(code:string)=>hasPreopPermission(permissions.value,code); const canEdit=computed(()=>persistenceAvailable.value&&assessment.status==='draft'&&has('preop.assessment.create')); const canSubmit=computed(()=>canEdit.value&&has('preop.assessment.submit')); const canWithdraw=computed(()=>persistenceAvailable.value&&assessment.status==='submitted'&&has('preop.assessment.submit')); const statusText=computed(()=>assessment.status==='submitted'?'已提交':'草稿');
function replace<T extends object>(target:T,value:T){Object.keys(target).forEach(k=>delete (target as Record<string,unknown>)[k]);Object.assign(target,value);}
const lines=(text:string)=>text.split('\n').map(v=>v.trim()).filter(Boolean).map(summary=>({summary})); const toText=(value:unknown)=>Array.isArray(value)?value.map(v=>String((v as Record<string,unknown>)?.summary??(v as Record<string,unknown>)?.name??v)).join('\n'):'';
function hydrate(detail:PreoperativeAssessmentDetailApi){replace(operationCase,detail.operationCase);replace(assessment,detail.assessment??emptyPreoperativeAssessment(detail.operationCase.operationId??selectedId.value));history.value=detail.history??[];persistenceAvailable.value=detail.persistence.available;Object.assign(textForm,{asaGrade:assessment.asaGrade??'',riskLevel:assessment.riskLevel??'',allergyHistory:assessment.allergyHistory??'',pastAnesthesiaHistory:assessment.pastAnesthesiaHistory??'',airwayAssessment:assessment.airwayAssessment??'',preMedicationAdvice:assessment.preMedicationAdvice??'',riskSummary:assessment.riskSummary??'',abnormalExamSummary:assessment.abnormalExamSummary??''});medicalHistoryText.value=toText(assessment.medicalHistoryJson);surgicalHistoryText.value=toText(assessment.surgicalHistoryJson);medicationHistoryText.value=toText(assessment.medicationHistoryJson);examText.value=toText(assessment.examAbnormalitiesJson);riskText.value=toText(assessment.riskFactorsJson);recommendationText.value=toText(assessment.recommendationsJson);systemAssessmentText.value=String(assessment.systemAssessmentJson?.summary??'');structured.mallampati=String(assessment.airwayJson?.mallampati??'');structured.mouthOpeningCm=Number(assessment.airwayJson?.mouthOpeningCm)||undefined;structured.solidHours=Number(assessment.fastingJson?.solidHours)||undefined;structured.clearFluidHours=Number(assessment.fastingJson?.clearFluidHours)||undefined;structured.dentitionSummary=String(assessment.dentitionJson?.summary??'');}
function payload(){return {...assessment,asaGrade:textForm.asaGrade||null,riskLevel:(textForm.riskLevel||null) as PreoperativeAssessmentApi['riskLevel'],allergyHistory:textForm.allergyHistory,pastAnesthesiaHistory:textForm.pastAnesthesiaHistory,airwayAssessment:textForm.airwayAssessment,preMedicationAdvice:textForm.preMedicationAdvice,riskSummary:textForm.riskSummary,abnormalExamSummary:textForm.abnormalExamSummary,medicalHistoryJson:lines(medicalHistoryText.value),surgicalHistoryJson:lines(surgicalHistoryText.value),medicationHistoryJson:lines(medicationHistoryText.value),systemAssessmentJson:{summary:systemAssessmentText.value},examAbnormalitiesJson:lines(examText.value),riskFactorsJson:lines(riskText.value),recommendationsJson:lines(recommendationText.value),airwayJson:{mallampati:structured.mallampati||null,mouthOpeningCm:structured.mouthOpeningCm??null},fastingJson:{solidHours:structured.solidHours??null,clearFluidHours:structured.clearFluidHours??null},dentitionJson:{summary:structured.dentitionSummary}};}
async function loadDetail(id:string){if(!id)return;loading.value=true;errorMessage.value='';try{hydrate(await loadPreoperativeAssessment(id));}catch(e){errorMessage.value=e instanceof Error?e.message:'加载失败';}finally{loading.value=false;}}
async function saveDraft(){saving.value=true;try{replace(assessment,await savePreoperativeAssessmentDraft(selectedId.value,payload()));Message.success('草稿已保存');await loadDetail(selectedId.value);}catch(e){Message.error(e instanceof Error?e.message:'保存失败');}finally{saving.value=false;}}
async function submitAssessment(){saving.value=true;try{const saved=await savePreoperativeAssessmentDraft(selectedId.value,payload());replace(assessment,await submitPreoperativeAssessment(saved));Message.success('评估已提交');await loadDetail(selectedId.value);}catch(e){Message.error(e instanceof Error?e.message:'提交失败');}finally{saving.value=false;}}
async function withdrawAssessment(){if(!actionReason.value.trim()){Message.warning('请填写撤回原因');return;}saving.value=true;try{replace(assessment,await cancelPreoperativeAssessmentSubmit(assessment,actionReason.value));actionReason.value='';await loadDetail(selectedId.value);Message.success('已撤回为草稿');}catch(e){Message.error(e instanceof Error?e.message:'撤回失败');}finally{saving.value=false;}}
async function createRevision(){if(!actionReason.value.trim()){Message.warning('请填写修订原因');return;}saving.value=true;try{replace(assessment,await createPreoperativeAssessmentRevision(assessment,actionReason.value));actionReason.value='';await loadDetail(selectedId.value);Message.success('已创建修订草稿');}catch(e){Message.error(e instanceof Error?e.message:'修订失败');}finally{saving.value=false;}}
async function init(){loading.value=true;try{const [list,perm]=await Promise.all([loadOperationCases(),authApi.myPermissions()]);cases.value=list;permissions.value=Array.isArray(perm?.permissions)?perm.permissions.map(String):[];selectedId.value=list[0]?.operationId??'';}catch(e){errorMessage.value=e instanceof Error?e.message:'病例加载失败';}finally{loading.value=false;}}
watch(selectedId,id=>loadDetail(id));onMounted(init);
</script>
