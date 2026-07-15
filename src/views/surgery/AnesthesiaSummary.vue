<template>
  <ModulePageShell title="麻醉小结" description="自动区由服务端临床关系表聚合；医生补充区独立保存并受版本控制">
    <template #toolbar>
      <a-select v-model="selectedOperationId" :loading="caseLoading" style="width: 360px" placeholder="选择手术病例" allow-search>
        <a-option v-for="item in cases" :key="item.operationId!" :value="item.operationId!">
          {{ item.patientName || '—' }} · {{ item.operationName || item.plannedOperationName || '—' }}
        </a-option>
      </a-select>
      <a-button :loading="caseLoading || workflow.loading" @click="reload">刷新</a-button>
      <a-button v-if="workflow.detail?.history.length" @click="historyVisible = true">版本历史</a-button>
    </template>

    <a-alert v-if="caseError || workflow.error" type="error" show-icon style="margin-bottom: 12px">{{ caseError || workflow.error }}</a-alert>
    <a-spin :loading="caseLoading || workflow.loading" style="width:100%">
      <template v-if="selectedCase">
        <a-card class="section-card" :bordered="false" title="患者与手术信息">
          <OperationCaseSummary :case-data="workflow.detail?.operationCase || selectedCase" />
        </a-card>

        <a-card v-if="!current" class="section-card" :bordered="false" title="尚未生成麻醉小结">
          <EmptyState title="暂无麻醉小结" description="读取页面不会创建记录；请在临床记录完整后主动生成草稿" icon="IconFile" />
          <div v-if="can('summary.write')" class="center-action"><a-button type="primary" :loading="workflow.saving" @click="generate">生成小结草稿</a-button></div>
        </a-card>

        <template v-else>
          <a-card class="section-card" :bordered="false" title="版本与来源">
            <a-descriptions :column="3" bordered size="small">
              <a-descriptions-item label="状态"><a-tag :color="statusColor(current.status)">{{ statusLabel(current.status) }}</a-tag></a-descriptions-item>
              <a-descriptions-item label="版本">{{ current.version }}</a-descriptions-item>
              <a-descriptions-item label="来源记录版本">{{ current.sourceRecordRevisionId || '—' }}</a-descriptions-item>
              <a-descriptions-item label="来源哈希">{{ current.sourceContentHash || '—' }}</a-descriptions-item>
              <a-descriptions-item label="内容哈希">{{ current.contentHash || '草稿未冻结' }}</a-descriptions-item>
              <a-descriptions-item label="生成时间">{{ current.generatedPayload?.generatedAt || '—' }}</a-descriptions-item>
            </a-descriptions>
            <a-alert type="info" style="margin-top:12px">内部签名、打印标记和归档引用已记录；CA、正式 PDF 与正式文档归档由 P12 完成。</a-alert>
          </a-card>

          <a-card class="section-card" :bordered="false" title="自动聚合区（只读）">
            <a-descriptions :column="3" bordered size="small">
              <a-descriptions-item label="术前诊断">{{ payload.case?.diagnosis || '—' }}</a-descriptions-item>
              <a-descriptions-item label="手术名称">{{ payload.case?.surgeryName || '—' }}</a-descriptions-item>
              <a-descriptions-item label="麻醉方式">{{ payload.case?.anesthesiaMethod || '—' }}</a-descriptions-item>
              <a-descriptions-item label="麻醉时长">{{ duration(payload.timeline?.anesthesiaDurationMinutes) }}</a-descriptions-item>
              <a-descriptions-item label="手术时长">{{ duration(payload.timeline?.surgeryDurationMinutes) }}</a-descriptions-item>
              <a-descriptions-item label="术后去向">{{ payload.outcome?.postoperativeDestination || '—' }}</a-descriptions-item>
            </a-descriptions>
            <div class="metric-grid">
              <div class="metric"><span>气道</span><strong>{{ payload.airway?.length ?? 0 }}</strong></div>
              <div class="metric"><span>通气</span><strong>{{ payload.ventilation?.length ?? 0 }}</strong></div>
              <div class="metric"><span>用药</span><strong>{{ payload.medications?.length ?? 0 }}</strong></div>
              <div class="metric"><span>液体/输血</span><strong>{{ (payload.fluids?.length ?? 0) + (payload.transfusions?.length ?? 0) }}</strong></div>
              <div class="metric"><span>出入量</span><strong>{{ payload.ioRecords?.length ?? 0 }}</strong></div>
              <div class="metric"><span>异常化验</span><strong>{{ payload.labAbnormalities?.length ?? 0 }}</strong></div>
              <div class="metric"><span>关键事件</span><strong>{{ payload.events?.length ?? 0 }}</strong></div>
              <div class="metric"><span>抢救事件</span><strong>{{ payload.rescueEvents?.length ?? 0 }}</strong></div>
            </div>
            <a-table v-if="monitorRows.length" :data="monitorRows" :pagination="false" row-key="metric" size="small">
              <template #columns><a-table-column title="监测指标" data-index="metric" /><a-table-column title="最低" data-index="min" /><a-table-column title="最高" data-index="max" /><a-table-column title="单位" data-index="unit" /></template>
            </a-table>
            <a-alert v-if="payload.recovery" type="success" style="margin-top:12px">恢复状态：{{ payload.recovery.status || '—' }}；入 PACU：{{ payload.recovery.inAt || '—' }}；出 PACU：{{ payload.recovery.outAt || '—' }}</a-alert>
          </a-card>

          <a-card class="section-card" :bordered="false" title="医生补充区">
            <a-form :model="form" layout="vertical" :disabled="readOnly">
              <a-row :gutter="16">
                <a-col :span="8"><a-form-item label="麻醉效果"><a-select v-model="form.effectRating" allow-clear><a-option value="优">优</a-option><a-option value="良">良</a-option><a-option value="中">中</a-option><a-option value="差">差</a-option></a-select></a-form-item></a-col>
                <a-col :span="16"><a-form-item label="术后去向"><a-input v-model="form.postoperativeDestination" /></a-form-item></a-col>
              </a-row>
              <a-form-item label="术中评价"><a-textarea v-model="form.intraoperativeNotes" :auto-size="{minRows:3}" /></a-form-item>
              <a-form-item label="恢复评价"><a-textarea v-model="form.recoveryNotes" :auto-size="{minRows:3}" /></a-form-item>
              <a-form-item label="并发症结论"><a-textarea v-model="form.complicationSummary" :auto-size="{minRows:2}" /></a-form-item>
              <a-form-item label="其他说明"><a-textarea v-model="form.otherNotes" :auto-size="{minRows:2}" /></a-form-item>
            </a-form>
            <div class="form-actions">
              <a-space wrap>
                <a-button v-if="can('summary.write')" :disabled="readOnly" :loading="workflow.saving" @click="saveDraft">保存医生补充</a-button>
                <a-button v-if="can('summary.write')" :disabled="readOnly" :loading="workflow.saving" @click="generate">重新聚合自动区</a-button>
                <a-button v-if="current.status==='draft' && can('summary.submit')" type="primary" :loading="workflow.saving" @click="submit">提交并冻结</a-button>
                <a-input v-if="current.status!=='draft' && can('summary.revise')" v-model="revisionReason" style="width:220px" placeholder="修订原因" />
                <a-button v-if="current.status!=='draft' && can('summary.revise')" :loading="workflow.saving" @click="createRevision">创建修订草稿</a-button>
                <a-input v-if="current.status==='submitted' && can('summary.sign')" v-model="signatureDocumentId" style="width:220px" placeholder="内部签名引用" />
                <a-button v-if="current.status==='submitted' && can('summary.sign')" :loading="workflow.saving" @click="sign">记录内部签名</a-button>
                <a-button v-if="['submitted','signed'].includes(current.status) && can('document.export')" :loading="workflow.saving" @click="markPrinted">标记已打印</a-button>
                <a-button v-if="current.status==='signed' && can('summary.archive')" type="primary" :loading="workflow.saving" @click="archive">归档版本</a-button>
              </a-space>
            </div>
          </a-card>
        </template>
      </template>
      <EmptyState v-else title="暂无手术病例" description="服务端当前没有可生成小结的 OperationCase" icon="IconFile" />
    </a-spin>
    <AnesthesiaSummaryHistoryDrawer v-model:visible="historyVisible" :history="workflow.detail?.history ?? []" />
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import EmptyState from '@/components/shared/EmptyState.vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import OperationCaseSummary from '@/components/preoperative/OperationCaseSummary.vue';
import AnesthesiaSummaryHistoryDrawer from '@/components/surgery/AnesthesiaSummaryHistoryDrawer.vue';
import { loadOperationCases } from '@/services/preoperative/preoperativeFiveFlowsService';
import type { OperationCase } from '@/services/anesthesia/adapters/operationInfoAdapter';
import { useAnesthesiaSummaryStore } from '@/stores/anesthesiaWorkflow';
import { authApi } from '@/api/auth';

const workflow=useAnesthesiaSummaryStore();const cases=ref<OperationCase[]>([]);const selectedOperationId=ref('');const caseLoading=ref(false);const caseError=ref('');const historyVisible=ref(false);const revisionReason=ref('');const signatureDocumentId=ref('');
const permissions=ref<string[]>([]);const can=(code:string)=>permissions.value.some(value=>value==='*'||value==='summary.*'||value===code);
const selectedCase=computed(()=>cases.value.find(v=>v.operationId===selectedOperationId.value)??null);const current=computed(()=>workflow.detail?.currentSummary??null);const payload=computed(()=>current.value?.generatedPayload??({} as NonNullable<typeof current.value>['generatedPayload']));
const readOnly=computed(()=>current.value?.status!=='draft');const monitorRows=computed(()=>Object.entries(payload.value.monitoring??{}).map(([metric,value])=>({metric,...value})));
const form=reactive({effectRating:'',intraoperativeNotes:'',recoveryNotes:'',complicationSummary:'',postoperativeDestination:'',otherNotes:''});
const statusLabel=(value:string)=>({draft:'草稿',submitted:'已提交',signed:'已签名',archived:'已归档',cancelled:'已取消'}[value]??value);const statusColor=(value:string)=>({draft:'orange',submitted:'arcoblue',signed:'green',archived:'purple',cancelled:'red'}[value]??'gray');const duration=(value?:number|null)=>value==null?'—':`${Math.floor(value/60)}小时${value%60}分`;
function hydrate(){const s=current.value?.doctorSupplement??{};Object.assign(form,{effectRating:s.effectRating??current.value?.effectRating??'',intraoperativeNotes:s.intraoperativeNotes??current.value?.intraoperativeNotes??'',recoveryNotes:s.recoveryNotes??current.value?.recoveryNotes??'',complicationSummary:s.complicationSummary??current.value?.complicationSummary??'',postoperativeDestination:s.postoperativeDestination??current.value?.postoperativeDestination??'',otherNotes:s.otherNotes??''});}
async function loadCases(){caseLoading.value=true;caseError.value='';try{cases.value=await loadOperationCases();if(!selectedOperationId.value)selectedOperationId.value=String(cases.value[0]?.operationId??'');}catch(e){cases.value=[];caseError.value=e instanceof Error?e.message:'加载病例失败';}finally{caseLoading.value=false;}}
async function loadSummary(){if(!selectedOperationId.value)return;try{await workflow.load(selectedOperationId.value);hydrate();}catch{/* store显示错误 */}}
async function reload(){await loadCases();await loadSummary();}
async function generate(){try{await workflow.generate();hydrate();Message.success('自动区已由服务端聚合并回读');}catch{/* store显示错误 */}}
async function saveDraft(){try{await workflow.saveDraft({doctorSupplement:{...form}});hydrate();Message.success('医生补充已保存并回读');}catch{/* store显示错误 */}}
async function submit(){try{await workflow.submit();hydrate();Message.success('小结已提交并冻结');}catch{/* store显示错误 */}}
async function createRevision(){try{await workflow.createRevision(revisionReason.value);revisionReason.value='';hydrate();Message.success('修订草稿已创建');}catch(e){Message.error(e instanceof Error?e.message:'创建修订失败');}}
async function sign(){if(!signatureDocumentId.value.trim()){Message.warning('请填写内部签名引用');return;}try{await workflow.sign(signatureDocumentId.value.trim());hydrate();Message.success('内部签名状态已记录');}catch{/* store显示错误 */}}
async function markPrinted(){try{await workflow.markPrinted();hydrate();Message.success('打印状态已记录');}catch{/* store显示错误 */}}
async function archive(){try{await workflow.archive();hydrate();Message.success('小结版本已归档');}catch{/* store显示错误 */}}
async function loadPermissions(){try{const result=await authApi.myPermissions();permissions.value=Array.isArray(result?.permissions)?result.permissions.map(String):[];}catch{permissions.value=[];}}
watch(selectedOperationId,loadSummary);onMounted(()=>Promise.all([loadPermissions(),loadCases()]));
</script>

<style scoped>
.center-action{text-align:center;margin-top:16px}.metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:16px 0}.metric{display:flex;justify-content:space-between;padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm)}.metric span{color:var(--text-secondary)}.form-actions{margin-top:20px;padding-top:16px;border-top:1px solid var(--border)}@media(max-width:900px){.metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
