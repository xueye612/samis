<template>
  <ModulePageShell title="术后镇痛管理" description="镇痛方案创建、参数调整、评估和状态流转">
    <template #toolbar>
      <a-select v-model="selectedOperationId" style="width: 280px" placeholder="选择手术病例" allow-clear @change="onSelectChange as any">
        <a-option v-for="item in store.cases" :key="item.id" :value="item.id">
          {{ item.room }} · {{ item.patientName }} · {{ item.surgeryName }}
        </a-option>
      </a-select>
    </template>

    <a-spin :loading="analgesia.loading" style="width: 100%">
      <!-- 错误提示 -->
      <a-alert v-if="analgesia.error" type="error" :title="analgesia.error" closable @close="analgesia.error = null" style="margin-bottom: 16px" />

      <!-- 空数据 -->
      <EmptyState v-if="!selectedOperationId" title="请选择手术病例" description="从上方下拉框选择需要管理镇痛方案的病例" icon="IconFile" />

      <!-- 无方案 -->
      <a-card v-else-if="!analgesia.currentPlan" class="section-card" :bordered="false" title="镇痛方案">
        <a-empty description="该病例暂无镇痛方案">
          <a-button type="primary" :loading="analgesia.saving" @click="onCreateDraft">新建镇痛方案</a-button>
        </a-empty>
      </a-card>

      <!-- 方案详情 -->
      <template v-else>
        <a-card class="section-card" :bordered="false">
          <template #title>
            <span>镇痛方案 · </span>
            <StatusTag :value="analgesia.currentPlan.status" />
            <a-tag v-if="analgesia.isReadOnly" color="gray" style="margin-left: 8px">只读</a-tag>
          </template>
          <template #extra>
            <a-space>
              <a-button v-if="analgesia.canStart" type="primary" :loading="analgesia.saving" @click="onStart">启动</a-button>
              <a-button v-if="analgesia.canPause" :loading="analgesia.saving" @click="onPause">暂停</a-button>
              <a-button v-if="analgesia.canResume" type="primary" :loading="analgesia.saving" @click="onResume">恢复</a-button>
              <a-button v-if="analgesia.canStop" status="warning" :loading="analgesia.saving" @click="onStop">停止</a-button>
              <a-button v-if="analgesia.canComplete" status="success" :loading="analgesia.saving" @click="onComplete">完成</a-button>
              <a-button v-if="analgesia.canVoid" status="danger" :loading="analgesia.saving" @click="onVoid">作废</a-button>
            </a-space>
          </template>

          <a-descriptions :column="3" bordered size="medium">
            <a-descriptions-item label="镇痛方式">{{ analgesia.currentPlan.methodCode ?? '—' }}</a-descriptions-item>
            <a-descriptions-item label="背景速率">{{ analgesia.currentPlan.backgroundRateMlH ?? '—' }} ml/h</a-descriptions-item>
            <a-descriptions-item label="自控 bolus">{{ analgesia.currentPlan.bolusMl ?? '—' }} ml</a-descriptions-item>
            <a-descriptions-item label="锁定时间">{{ analgesia.currentPlan.lockoutMinutes ?? '—' }} min</a-descriptions-item>
            <a-descriptions-item label="泵总容量">{{ analgesia.currentPlan.pumpTotalMl ?? '—' }} ml</a-descriptions-item>
            <a-descriptions-item label="版本">v{{ analgesia.currentPlan.version }}</a-descriptions-item>
            <a-descriptions-item label="启动时间">{{ analgesia.currentPlan.startedAt ?? '—' }}</a-descriptions-item>
            <a-descriptions-item label="停止时间">{{ analgesia.currentPlan.stoppedAt ?? '—' }}</a-descriptions-item>
            <a-descriptions-item v-if="analgesia.currentPlan.voidReason" label="作废原因">{{ analgesia.currentPlan.voidReason }}</a-descriptions-item>
          </a-descriptions>

          <!-- 草稿编辑表单 -->
          <a-form v-if="analgesia.currentPlan.status === 'draft'" :model="draftForm" layout="vertical" style="margin-top: 16px">
            <a-row :gutter="14">
              <a-col :span="8"><a-form-item label="镇痛方式"><a-input v-model="draftForm.methodCode" placeholder="如 PCIA/PCEA" /></a-form-item></a-col>
              <a-col :span="6"><a-form-item label="背景速率(ml/h)"><a-input-number v-model="draftForm.backgroundRateMlH" :min="0" :step="0.5" /></a-form-item></a-col>
              <a-col :span="5"><a-form-item label="bolus(ml)"><a-input-number v-model="draftForm.bolusMl" :min="0" :step="0.5" /></a-form-item></a-col>
              <a-col :span="5"><a-form-item label="锁定(min)"><a-input-number v-model="draftForm.lockoutMinutes" :min="0" /></a-form-item></a-col>
              <a-col :span="24">
                <a-space>
                  <a-button type="primary" :loading="analgesia.saving" @click="onSaveDraft">保存草稿</a-button>
                </a-space>
              </a-col>
            </a-row>
          </a-form>

          <!-- 参数调整 -->
          <a-form v-if="analgesia.canAdjust" :model="adjustForm" layout="vertical" style="margin-top: 16px">
            <a-divider orientation="left">参数调整</a-divider>
            <a-row :gutter="14">
              <a-col :span="6"><a-form-item label="背景速率(ml/h)"><a-input-number v-model="adjustForm.backgroundRateMlH" :min="0" :step="0.5" /></a-form-item></a-col>
              <a-col :span="5"><a-form-item label="bolus(ml)"><a-input-number v-model="adjustForm.bolusMl" :min="0" :step="0.5" /></a-form-item></a-col>
              <a-col :span="5"><a-form-item label="锁定(min)"><a-input-number v-model="adjustForm.lockoutMinutes" :min="0" /></a-form-item></a-col>
              <a-col :span="8"><a-form-item label="调整原因"><a-input v-model="adjustForm.reason" placeholder="必填" /></a-form-item></a-col>
            </a-row>
            <a-button type="outline" :loading="analgesia.saving" @click="onAdjust">提交调整</a-button>
          </a-form>

          <!-- 镇痛评估 -->
          <a-form v-if="analgesia.canAssess" :model="assessForm" layout="vertical" style="margin-top: 16px">
            <a-divider orientation="left">镇痛评估</a-divider>
            <a-row :gutter="14">
              <a-col :span="4"><a-form-item label="VAS"><a-input-number v-model="assessForm.vasScore" :min="0" :max="10" :step="0.5" /></a-form-item></a-col>
              <a-col :span="4"><a-form-item label="镇静"><a-input-number v-model="assessForm.sedationScore" :min="0" :max="10" :step="0.5" /></a-form-item></a-col>
              <a-col :span="4"><a-form-item label="恶心呕吐"><a-input-number v-model="assessForm.ponvScore" :min="0" :max="10" :step="0.5" /></a-form-item></a-col>
              <a-col :span="4"><a-form-item label="瘙痒"><a-input-number v-model="assessForm.pruritusScore" :min="0" :max="10" :step="0.5" /></a-form-item></a-col>
              <a-col :span="4"><a-form-item label="呼吸抑制"><a-switch v-model="assessForm.respiratoryDepression" /></a-form-item></a-col>
              <a-col :span="4"><a-button type="primary" :loading="analgesia.saving" @click="onAssess" style="margin-top: 30px">提交评估</a-button></a-col>
            </a-row>
            <a-alert v-for="alert in assessAlerts" :key="alert" type="warning" :message="alert === 'respiratory_depression' ? '呼吸抑制告警' : '重度疼痛告警(VAS≥7)'" style="margin-top: 8px" />
          </a-form>
        </a-card>

        <!-- 调整历史 -->
        <a-card v-if="analgesia.detail && analgesia.detail.adjustments.length" class="section-card" :bordered="false" title="调整历史" style="margin-top: 16px">
          <a-timeline>
            <a-timeline-item v-for="adj in analgesia.detail.adjustments" :key="adj.adjustmentId">
              <p>{{ adj.adjustedAt }} · {{ adj.reason }}</p>
              <p v-if="adj.before && adj.after" style="color: var(--color-text-3)">
                速率: {{ (adj.before as Record<string, number>).backgroundRateMlH }} → {{ (adj.after as Record<string, number>).backgroundRateMlH }} ml/h
              </p>
            </a-timeline-item>
          </a-timeline>
        </a-card>

        <!-- 评估趋势 -->
        <a-card v-if="analgesia.detail && analgesia.detail.assessments.length" class="section-card" :bordered="false" title="评估趋势" style="margin-top: 16px">
          <a-table :data="analgesia.detail.assessments" row-key="assessmentId" :pagination="{ pageSize: 5 }" size="small">
            <template #columns>
              <a-table-column title="时间" data-index="assessedAt" :width="160" />
              <a-table-column title="VAS" data-index="vasScore" :width="80" />
              <a-table-column title="镇静" data-index="sedationScore" :width="80" />
              <a-table-column title="恶心呕吐" data-index="ponvScore" :width="100" />
              <a-table-column title="瘙痒" data-index="pruritusScore" :width="80" />
              <a-table-column title="呼吸抑制" :width="100">
                <template #cell="{ record }"><a-tag :color="record.respiratoryDepression ? 'red' : 'green'">{{ record.respiratoryDepression ? '是' : '否' }}</a-tag></template>
              </a-table-column>
            </template>
          </a-table>
        </a-card>
      </template>
    </a-spin>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import EmptyState from '@/components/shared/EmptyState.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import { usePostAnalgesiaStore } from '@/stores/postAnalgesia';

const store = useAnesthesiaStore();
const analgesia = usePostAnalgesiaStore();
const selectedOperationId = ref('');

const draftForm = ref({ methodCode: '', backgroundRateMlH: undefined as number | undefined, bolusMl: undefined as number | undefined, lockoutMinutes: undefined as number | undefined });
const adjustForm = ref({ backgroundRateMlH: undefined as number | undefined, bolusMl: undefined as number | undefined, lockoutMinutes: undefined as number | undefined, reason: '' });
const assessForm = ref({ vasScore: undefined as number | undefined, sedationScore: undefined as number | undefined, ponvScore: undefined as number | undefined, pruritusScore: undefined as number | undefined, respiratoryDepression: false });
const assessAlerts = ref<string[]>([]);

const onSelectChange = async (val: string | undefined) => {
  selectedOperationId.value = val ?? '';
  analgesia.reset();
  if (selectedOperationId.value) {
    try {
      await analgesia.load(selectedOperationId.value);
      syncFormFromCurrent();
    } catch {
      // error handled in store
    }
  }
};

const syncFormFromCurrent = () => {
  const c = analgesia.currentPlan;
  if (c) {
    draftForm.value = {
      methodCode: c.methodCode ?? '',
      backgroundRateMlH: c.backgroundRateMlH ?? undefined,
      bolusMl: c.bolusMl ?? undefined,
      lockoutMinutes: c.lockoutMinutes ?? undefined,
    };
    adjustForm.value = {
      backgroundRateMlH: c.backgroundRateMlH ?? undefined,
      bolusMl: c.bolusMl ?? undefined,
      lockoutMinutes: c.lockoutMinutes ?? undefined,
      reason: '',
    };
  }
};

const onCreateDraft = async () => {
  try {
    await analgesia.saveDraft({ methodCode: 'PCIA', backgroundRateMlH: 2, bolusMl: 2, lockoutMinutes: 15 });
    syncFormFromCurrent();
    Message.success('草稿已创建');
  } catch (e) {
    Message.error(analgesia.error ?? '创建失败');
  }
};

const onSaveDraft = async () => {
  try {
    await analgesia.saveDraft(draftForm.value);
    Message.success('草稿已保存');
  } catch (e) {
    Message.error(analgesia.error ?? '保存失败');
  }
};

const onStart = async () => { try { await analgesia.start(); Message.success('已启动'); } catch { Message.error(analgesia.error ?? '操作失败'); } };
const onPause = async () => { try { await analgesia.pause(); Message.success('已暂停'); } catch { Message.error(analgesia.error ?? '操作失败'); } };
const onResume = async () => { try { await analgesia.resume(); Message.success('已恢复'); } catch { Message.error(analgesia.error ?? '操作失败'); } };
const onStop = async () => { try { await analgesia.stop(); Message.success('已停止'); } catch { Message.error(analgesia.error ?? '操作失败'); } };
const onComplete = async () => { try { await analgesia.complete(); Message.success('已完成'); } catch { Message.error(analgesia.error ?? '操作失败'); } };

const onVoid = async () => {
  const reason = prompt('请输入作废原因');
  if (!reason) return;
  try { await analgesia.void_(reason); Message.success('已作废'); } catch { Message.error(analgesia.error ?? '操作失败'); }
};

const onAdjust = async () => {
  if (!adjustForm.value.reason.trim()) { Message.warning('调整原因必填'); return; }
  try {
    await analgesia.adjust(
      { backgroundRateMlH: adjustForm.value.backgroundRateMlH, bolusMl: adjustForm.value.bolusMl, lockoutMinutes: adjustForm.value.lockoutMinutes },
      adjustForm.value.reason,
    );
    syncFormFromCurrent();
    Message.success('参数已调整');
  } catch (e) {
    Message.error(analgesia.error ?? '调整失败');
  }
};

const onAssess = async () => {
  try {
    const result = await analgesia.assess(assessForm.value);
    assessAlerts.value = result.alerts;
    if (result.alerts.length) Message.warning('评估存在告警');
    else Message.success('评估完成');
    assessForm.value = { vasScore: undefined, sedationScore: undefined, ponvScore: undefined, pruritusScore: undefined, respiratoryDepression: false };
  } catch (e) {
    Message.error(analgesia.error ?? '评估失败');
  }
};
</script>
