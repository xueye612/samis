<template>
  <ModulePageShell title="麻醉交班" description="病例来自 OperationCase；交班内容、核查和临床快照保存于 SAMIS">
    <template #toolbar>
      <a-select v-model="selectedOperationId" :loading="caseLoading" style="width: 360px" placeholder="选择手术病例" allow-search>
        <a-option v-for="item in cases" :key="item.operationId!" :value="item.operationId!">
          {{ item.roomName || '未排手术间' }} · {{ item.patientName || '—' }} · {{ item.operationName || item.plannedOperationName || '—' }}
        </a-option>
      </a-select>
      <a-button :loading="caseLoading || workflow.loading" @click="reload">刷新</a-button>
      <a-button v-if="workflow.detail?.history.length" @click="historyVisible = true">历史版本</a-button>
    </template>

    <a-alert v-if="caseError || workflow.error" type="error" show-icon style="margin-bottom: 12px">
      {{ caseError || workflow.error }}
    </a-alert>
    <a-spin :loading="caseLoading || workflow.loading" style="width: 100%">
      <template v-if="selectedCase">
        <a-card class="section-card" :bordered="false" title="患者与手术信息">
          <OperationCaseSummary :case-data="workflow.detail?.operationCase || selectedCase" />
        </a-card>

        <a-card class="section-card" :bordered="false">
          <template #title>交班记录 · {{ statusLabel(current?.status) }}</template>
          <template #extra><a-tag color="arcoblue">版本 {{ current?.version ?? 0 }}</a-tag></template>
          <a-form :model="form" layout="vertical" :disabled="readOnly">
            <a-row :gutter="16">
              <a-col :span="8"><a-form-item label="交班类型"><a-select v-model="form.handoverType" :options="handoverTypes" /></a-form-item></a-col>
              <a-col :span="8"><a-form-item label="交班医师"><a-input :model-value="current?.outgoingDoctorName || '由当前登录用户确定'" disabled /></a-form-item></a-col>
              <a-col :span="8"><a-form-item label="接班医师工号" required><a-input v-model="form.incomingDoctorId" /></a-form-item></a-col>
            </a-row>
            <a-divider>结构化交班内容</a-divider>
            <a-row :gutter="16">
              <a-col :span="12"><a-form-item label="职责（每行一项）"><a-textarea v-model="form.responsibilities" :auto-size="{ minRows: 2 }" /></a-form-item></a-col>
              <a-col :span="12"><a-form-item label="当前问题（每行一项）"><a-textarea v-model="form.activeProblems" :auto-size="{ minRows: 2 }" /></a-form-item></a-col>
              <a-col :span="12"><a-form-item label="风险（每行一项）"><a-textarea v-model="form.riskItems" :auto-size="{ minRows: 2 }" /></a-form-item></a-col>
              <a-col :span="12"><a-form-item label="设备状态（每行一项）"><a-textarea v-model="form.equipment" :auto-size="{ minRows: 2 }" /></a-form-item></a-col>
              <a-col :span="12"><a-form-item label="管路状态（每行一项）"><a-textarea v-model="form.lines" :auto-size="{ minRows: 2 }" /></a-form-item></a-col>
              <a-col :span="12"><a-form-item label="持续用药（每行一项）"><a-textarea v-model="form.activeMedications" :auto-size="{ minRows: 2 }" /></a-form-item></a-col>
              <a-col :span="12"><a-form-item label="待办（每行一项）"><a-textarea v-model="form.pendingTasks" :auto-size="{ minRows: 2 }" /></a-form-item></a-col>
              <a-col :span="12"><a-form-item label="重点提示"><a-textarea v-model="form.priorityNotes" :auto-size="{ minRows: 2 }" /></a-form-item></a-col>
            </a-row>
            <a-form-item label="特殊说明"><a-textarea v-model="form.specialNotes" /></a-form-item>
            <a-form-item v-if="form.handoverType === 'emergency'" label="紧急交班原因" required><a-textarea v-model="form.emergencyReason" /></a-form-item>

            <a-divider>核查确认</a-divider>
            <div class="check-grid">
              <div v-for="check in form.checks" :key="check.itemCode" class="check-item">
                <strong>{{ check.label }}</strong>
                <a-radio-group v-model="check.result" type="button" size="small">
                  <a-radio value="confirmed">正常</a-radio><a-radio value="exception">异常</a-radio>
                </a-radio-group>
                <a-input v-if="check.result === 'exception'" v-model="check.remark" placeholder="异常项必须填写说明" />
              </div>
            </div>
          </a-form>

          <a-alert v-if="current?.clinicalSnapshot" type="info" style="margin-top: 16px">
            提交快照：气道 {{ current.clinicalSnapshot.airway?.length ?? 0 }} 条，通气 {{ current.clinicalSnapshot.ventilation?.length ?? 0 }} 条，
            持续用药 {{ current.clinicalSnapshot.activeMedications?.length ?? 0 }} 条，生命体征 {{ current.clinicalSnapshot.latestVitals?.length ?? 0 }} 条，
            抢救事件 {{ current.clinicalSnapshot.rescueEvents?.length ?? 0 }} 条；快照时间 {{ current.clinicalSnapshot.snapshotAt || '—' }}。
          </a-alert>

          <div class="form-actions">
            <a-space wrap>
              <a-button :loading="workflow.saving" :disabled="readOnly || current?.status === 'submitted'" @click="saveDraft">保存草稿</a-button>
              <a-button v-if="!current || current.status === 'draft'" type="primary" :loading="workflow.saving" @click="submit">提交交班</a-button>
              <a-button v-if="current?.status === 'submitted'" type="primary" :loading="workflow.saving" @click="accept">指定接班人确认</a-button>
              <a-input v-if="current && ['draft','submitted'].includes(current.status)" v-model="cancelReason" style="width: 220px" placeholder="取消原因" />
              <a-button v-if="current && ['draft','submitted'].includes(current.status)" status="danger" :loading="workflow.saving" @click="cancel">取消交班</a-button>
            </a-space>
          </div>
        </a-card>
      </template>
      <EmptyState v-else title="暂无手术病例" description="服务端当前没有可用于交班的 OperationCase" icon="IconSwap" />
    </a-spin>
    <HandoverHistoryDrawer v-model:visible="historyVisible" :history="workflow.detail?.history ?? []" />
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import EmptyState from '@/components/shared/EmptyState.vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import OperationCaseSummary from '@/components/preoperative/OperationCaseSummary.vue';
import HandoverHistoryDrawer from '@/components/surgery/HandoverHistoryDrawer.vue';
import { loadOperationCases } from '@/services/preoperative/preoperativeFiveFlowsService';
import type { OperationCase } from '@/services/anesthesia/adapters/operationInfoAdapter';
import { useAnesthesiaHandoverStore } from '@/stores/anesthesiaWorkflow';

const workflow = useAnesthesiaHandoverStore();
const cases = ref<OperationCase[]>([]); const selectedOperationId = ref(''); const caseLoading = ref(false); const caseError = ref('');
const historyVisible = ref(false); const cancelReason = ref('');
const selectedCase = computed(() => cases.value.find((item) => item.operationId === selectedOperationId.value) ?? null);
const current = computed(() => workflow.detail?.activeHandover ?? null);
const readOnly = computed(() => ['accepted','cancelled'].includes(current.value?.status ?? ''));
const handoverTypes = [{label:'常规换班',value:'shift_change'},{label:'临时交班',value:'temporary'},{label:'紧急交班',value:'emergency'}];
const statusLabel = (value?: string) => ({draft:'草稿',submitted:'待接班',accepted:'已接班',cancelled:'已取消'}[value ?? ''] ?? '未创建');
const form = reactive({
  handoverType:'shift_change',incomingDoctorId:'',responsibilities:'',activeProblems:'',riskItems:'',equipment:'',lines:'',activeMedications:'',pendingTasks:'',priorityNotes:'',specialNotes:'',emergencyReason:'',
  checks:[
    {itemCode:'equipment',label:'设备与备用设备',result:'confirmed' as 'confirmed'|'exception',remark:''},
    {itemCode:'medication',label:'持续用药与特殊药品',result:'confirmed' as 'confirmed'|'exception',remark:''},
    {itemCode:'airway',label:'气道与通气',result:'confirmed' as 'confirmed'|'exception',remark:''},
    {itemCode:'hemodynamics',label:'循环与出入量',result:'confirmed' as 'confirmed'|'exception',remark:''},
  ],
});
const lines = (value: string) => value.split(/\n+/).map((item) => item.trim()).filter(Boolean);
const descriptions = (value: string, prefix: string) => lines(value).map((description,index) => ({code:`${prefix}-${index+1}`,description}));
function hydrate(){const item=current.value;if(!item){Object.assign(form,{incomingDoctorId:'',responsibilities:'',activeProblems:'',riskItems:'',equipment:'',lines:'',activeMedications:'',pendingTasks:'',priorityNotes:'',specialNotes:'',emergencyReason:''});return;}Object.assign(form,{handoverType:item.handoverType,incomingDoctorId:item.incomingDoctorId??'',responsibilities:item.responsibilities.map(v=>v.description||v.label||v.code).join('\n'),activeProblems:item.activeProblems.map(v=>v.description).join('\n'),riskItems:item.riskItems.map(v=>v.label||v.code).join('\n'),equipment:item.equipment.map(v=>v.name||v.code).join('\n'),lines:item.lines.map(v=>`${v.type}${v.site?`·${v.site}`:''}`).join('\n'),activeMedications:item.activeMedications.map(v=>`${v.name}${v.rate?`·${v.rate}`:''}`).join('\n'),pendingTasks:item.pendingTasks.map(v=>v.description).join('\n'),priorityNotes:item.priorityNotes??'',specialNotes:item.specialNotes??'',emergencyReason:item.emergencyReason??''});form.checks.forEach(c=>{const saved=item.checks.find(v=>v.itemCode===c.itemCode);if(saved){c.result=saved.result==='exception'?'exception':'confirmed';c.remark=saved.remark??'';}});}
function payload(){return{handoverType:form.handoverType,incomingDoctorId:form.incomingDoctorId,responsibilities:descriptions(form.responsibilities,'RESP').map(v=>({...v,label:v.description})),activeProblems:descriptions(form.activeProblems,'PROBLEM'),riskItems:descriptions(form.riskItems,'RISK').map(v=>({code:v.code,label:v.description})),equipment:descriptions(form.equipment,'EQUIP').map(v=>({code:v.code,name:v.description,status:'normal'})),lines:descriptions(form.lines,'LINE').map(v=>({type:v.description,status:'active'})),activeMedications:descriptions(form.activeMedications,'MED').map(v=>({name:v.description})),pendingTasks:descriptions(form.pendingTasks,'TASK'),priorityNotes:form.priorityNotes,specialNotes:form.specialNotes,emergencyReason:form.emergencyReason,checks:form.checks.map(({itemCode,result,remark})=>({itemCode,result,remark}))};}
async function loadCases(){caseLoading.value=true;caseError.value='';try{cases.value=await loadOperationCases();if(!selectedOperationId.value)selectedOperationId.value=String(cases.value[0]?.operationId??'');}catch(e){cases.value=[];caseError.value=e instanceof Error?e.message:'加载病例失败';}finally{caseLoading.value=false;}}
async function loadHandover(){if(!selectedOperationId.value)return;try{await workflow.load(selectedOperationId.value);hydrate();}catch{/* store显示错误 */}}
async function reload(){await loadCases();await loadHandover();}
async function saveDraft(){if(!form.incomingDoctorId.trim()){Message.warning('请填写接班医师工号');return;}try{await workflow.saveDraft(payload());hydrate();Message.success('交班草稿已保存并回读');}catch{/* store显示错误 */}}
async function submit(){if(form.checks.some(v=>v.result==='exception'&&!v.remark.trim())){Message.warning('异常核查项必须填写说明');return;}try{await workflow.saveDraft(payload());await workflow.submit();hydrate();Message.success('交班已提交');}catch{/* store显示错误 */}}
async function accept(){try{await workflow.accept();hydrate();Message.success('接班确认完成');}catch{/* store显示错误 */}}
async function cancel(){try{await workflow.cancel(cancelReason.value);cancelReason.value='';hydrate();Message.success('交班已取消');}catch(e){Message.error(e instanceof Error?e.message:'取消失败');}}
watch(selectedOperationId,loadHandover);onMounted(loadCases);
</script>

<style scoped>
.check-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.check-item{display:grid;gap:8px;padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm)}.form-actions{margin-top:20px;padding-top:16px;border-top:1px solid var(--border)}@media(max-width:900px){.check-grid{grid-template-columns:1fr}}
</style>
