<template>
  <ModulePageShell title="麻醉小结" description="用药总览、液体/输血统计、关键事件与术中过程汇总">
    <template #toolbar>
      <a-select v-model="selectedCaseId" style="width: 300px" placeholder="选择患者">
        <a-option v-for="item in caseOptions" :key="item.id" :value="item.id">{{ item.patientName }} · {{ item.surgeryName }}</a-option>
      </a-select>
      <div v-if="caseItem" class="toolbar-end">
        <a-space :size="6">
          <StatusTag :value="caseItem.status" />
          <a-tag color="arcoblue">{{ caseItem.anesthesiaMethod }}</a-tag>
        </a-space>
      </div>
    </template>

    <template v-if="stats" #stats>
      <MetricCard label="麻醉时长" :value="durationText(stats.anesthesiaDurationMinutes)" icon="IconClockCircle" :hint="`手术时长 ${durationText(stats.surgeryDurationMinutes)}`" />
      <MetricCard label="入量合计" :value="`${stats.balance.intake} ml`" icon="IconSwap" :hint="`晶体 ${stats.fluid.crystalloidVolume} / 胶体 ${stats.fluid.colloidVolume} / 血制品 ${stats.fluid.bloodVolume} ml`" />
      <MetricCard label="出量合计" :value="`${stats.balance.output} ml`" icon="IconDownload" :hint="`尿量 ${stats.output.urine} / 出血 ${stats.output.bloodLoss} / 引流 ${stats.output.drainage} ml`" />
      <MetricCard label="净平衡" :value="`${stats.balance.net >= 0 ? '+' : ''}${stats.balance.net} ml`" icon="IconArrowRise" :variant="Math.abs(stats.balance.net) > 1500 ? 'warn' : 'default'" hint="入量 − 出量" />
      <MetricCard
        label="质控完整性"
        :value="`${stats.quality.completionRate}%`"
        icon="IconCheckCircle"
        :variant="stats.quality.missingCount > 0 ? 'warn' : 'default'"
        :hint="stats.quality.missingCount > 0 ? `${stats.quality.missingCount} 项待完善` : '检查项已完善'"
      />
    </template>

    <template v-if="caseItem && stats">
      <div class="summary-grid">
        <a-card class="section-card" :bordered="false" title="用药总览">
          <template #extra><span class="muted">有效 {{ stats.medication.total }} 条 · 持续 {{ stats.medication.continuousCount }} / 单次 {{ stats.medication.singleCount }}</span></template>
          <a-table v-if="stats.medication.categories.length" :data="stats.medication.categories" :pagination="false" row-key="category" size="small">
            <template #columns>
              <a-table-column title="药品类别" data-index="category" />
              <a-table-column title="条目" data-index="count" :width="70" align="right" />
              <a-table-column title="药品明细">
                <template #cell="{ record }">{{ record.drugs.join('、') }}</template>
              </a-table-column>
            </template>
          </a-table>
          <EmptyState v-else title="暂无术中用药" icon="IconExperiment" />
          <div v-if="stats.medication.highAlertCount" class="inline-flags">
            <a-tag :color="stats.medication.uncheckedHighAlertCount ? 'red' : 'green'">
              高警示 {{ stats.medication.highAlertCount }} 项{{ stats.medication.uncheckedHighAlertCount ? `（${stats.medication.uncheckedHighAlertCount} 项未核对）` : '·已核对' }}
            </a-tag>
          </div>
        </a-card>

        <a-card class="section-card" :bordered="false" title="液体 / 输血统计">
          <div class="fluid-stat-row">
            <div class="fluid-stat"><span class="fluid-stat__label">晶体液</span><strong>{{ stats.fluid.crystalloidVolume }} ml</strong></div>
            <div class="fluid-stat"><span class="fluid-stat__label">胶体液</span><strong>{{ stats.fluid.colloidVolume }} ml</strong></div>
            <div class="fluid-stat"><span class="fluid-stat__label">血液制品</span><strong>{{ stats.fluid.bloodVolume }} ml</strong></div>
            <div class="fluid-stat"><span class="fluid-stat__label">自体血回输</span><strong>{{ stats.fluid.autologousVolume }} ml</strong></div>
          </div>
          <a-table v-if="stats.fluid.bloodProducts.length" :data="stats.fluid.bloodProducts" :pagination="false" row-key="id" size="small" class="blood-table">
            <template #columns>
              <a-table-column title="血制品" data-index="name" />
              <a-table-column title="容量" :width="90">
                <template #cell="{ record }">{{ record.volume }}{{ record.unit }}</template>
              </a-table-column>
              <a-table-column title="血型" :width="80">
                <template #cell="{ record }">{{ record.bloodType || '-' }} {{ record.rh || '' }}</template>
              </a-table-column>
              <a-table-column title="核对" :width="90">
                <template #cell="{ record }"><a-tag :color="record.doubleCheck ? 'green' : 'red'">{{ record.doubleCheck ? '已双核对' : '未核对' }}</a-tag></template>
              </a-table-column>
              <a-table-column title="反应" :width="90">
                <template #cell="{ record }">
                  <a-tag v-if="record.reaction && record.reaction !== '无'" color="orange">{{ record.reaction }}</a-tag>
                  <span v-else class="muted">无</span>
                </template>
              </a-table-column>
            </template>
          </a-table>
          <EmptyState v-else title="未输注血液制品" icon="IconHeart" />
        </a-card>

        <a-card class="section-card summary-grid__full" :bordered="false" title="关键事件汇总">
          <template #extra><span class="muted">质控事件 {{ stats.event.qualityCount }} · 处理完成率 {{ stats.event.treatmentRate }}%</span></template>
          <a-timeline v-if="stats.event.items.length">
            <a-timeline-item
              v-for="event in stats.event.items"
              :key="event.id"
              :dot-color="severityColor(event.severity)"
            >
              <div class="event-line">
                <strong>{{ event.type }}</strong>
                <a-tag size="small" :color="severityTagColor(event.severity)">{{ event.severity }}</a-tag>
                <a-tag v-if="event.quality" size="small" color="arcoblue">质控</a-tag>
                <span class="muted">{{ event.stage }} · {{ event.timeText }}</span>
              </div>
              <p class="event-treatment" :class="{ 'event-treatment--missing': !event.hasTreatment }">{{ event.treatment }}</p>
            </a-timeline-item>
          </a-timeline>
          <EmptyState v-else title="术中无特殊事件" icon="IconCheckCircle" />
        </a-card>

        <a-card class="section-card summary-grid__full" :bordered="false" title="质控完整性自检">
          <div class="quality-grid">
            <div v-for="check in stats.quality.items" :key="check.key" class="quality-item" :class="`quality-item--${check.level}`">
              <AppIcon :name="check.level === 'ok' ? 'IconCheckCircle' : check.level === 'warn' ? 'IconExclamationCircle' : 'IconInfoCircle'" :size="16" />
              <div>
                <div class="quality-item__label">{{ check.label }}</div>
                <div class="quality-item__detail">{{ check.detail }}</div>
              </div>
            </div>
          </div>
          <div class="vital-extremes">
            <span>HR {{ extremeText(stats.vitalExtremes.HR) }} bpm</span>
            <span>SBP {{ extremeText(stats.vitalExtremes.SBP) }} mmHg</span>
            <span>SpO₂ {{ extremeText(stats.vitalExtremes.SpO2) }} %</span>
            <span>体温 {{ extremeText(stats.vitalExtremes.TEMP) }} ℃</span>
          </div>
        </a-card>
      </div>

      <a-card class="section-card" :bordered="false" title="麻醉效果与小结">
        <a-form :model="form" layout="vertical">
          <a-row :gutter="16">
            <a-col :span="8"><a-form-item label="患者"><a-input :model-value="caseItem.patientName" disabled /></a-form-item></a-col>
            <a-col :span="8"><a-form-item label="麻醉方式"><a-input :model-value="caseItem.anesthesiaMethod" disabled /></a-form-item></a-col>
            <a-col :span="8">
              <a-form-item label="麻醉效果">
                <a-select v-model="form.effectRating">
                  <a-option value="优">优</a-option>
                  <a-option value="良">良</a-option>
                  <a-option value="中">中</a-option>
                  <a-option value="差">差</a-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>
          <a-form-item label="术中记录"><a-textarea v-model="form.intraopNotes" :auto-size="{ minRows: 3 }" /></a-form-item>
          <a-form-item label="恢复情况"><a-textarea v-model="form.recoveryNotes" :auto-size="{ minRows: 3 }" /></a-form-item>
          <a-form-item label="并发症/特殊情况"><a-textarea v-model="form.complications" :auto-size="{ minRows: 2 }" /></a-form-item>
          <a-divider>签名</a-divider>
          <a-checkbox v-model="form.doctorSigned">麻醉医师签名</a-checkbox>
        </a-form>
        <div class="form-actions">
          <a-space>
            <a-button @click="save('草稿')">保存草稿</a-button>
            <a-button type="primary" @click="save('已提交')">提交小结</a-button>
          </a-space>
        </div>
      </a-card>
    </template>
    <EmptyState v-else title="请选择患者" description="从上方下拉框选择需要填写麻醉小结的患者" icon="IconFile" />
  </ModulePageShell>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, reactive, ref, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import AppIcon from '@/components/AppIcon.vue';
import MetricCard from '@/components/MetricCard.vue';
import StatusTag from '@/components/StatusTag.vue';
import EmptyState from '@/components/shared/EmptyState.vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { buildCaseSummaryStats, type VitalExtreme } from '@/services/caseSummaryStats';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { Severity } from '@/types/anesthesia';
import type { SummaryRecord } from '@/types/clinicalModules';

const store = useAnesthesiaStore();
const caseOptions = computed(() => store.cases.filter((item) => ['已离室', 'PACU', '苏醒中'].includes(item.status)));
const selectedCaseId = ref(store.summaryRecords[0]?.caseId ?? caseOptions.value[0]?.id ?? '');

const record = computed(() => store.summaryRecords.find((item) => item.caseId === selectedCaseId.value));
const caseItem = computed(() => store.cases.find((item) => item.id === selectedCaseId.value));
const stats = computed(() => (caseItem.value ? buildCaseSummaryStats(caseItem.value, { summarySigned: form.doctorSigned }) : undefined));

const form = reactive({
  intraopNotes: '',
  recoveryNotes: '',
  complications: '',
  effectRating: '优' as SummaryRecord['effectRating'],
  doctorSigned: false,
});

watch([record, selectedCaseId], () => {
  const target = record.value;
  if (target) {
    Object.assign(form, {
      intraopNotes: target.intraopNotes,
      recoveryNotes: target.recoveryNotes,
      complications: target.complications,
      effectRating: target.effectRating,
      doctorSigned: target.doctorSigned,
    });
    return;
  }
  if (caseItem.value) {
    Object.assign(form, {
      intraopNotes: '麻醉过程平稳',
      recoveryNotes: '苏醒良好',
      complications: '无',
      effectRating: '优',
      doctorSigned: false,
    });
  }
}, { immediate: true });

const durationText = (minutes?: number) => {
  if (minutes === undefined) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
};

const extremeText = (extreme: VitalExtreme) => {
  if (extreme.min === undefined || extreme.max === undefined) return '—';
  return extreme.min === extreme.max ? `${extreme.min}` : `${extreme.min}~${extreme.max}`;
};

const severityColor = (severity: Severity) => {
  if (severity === '危急') return 'rgb(220 38 38)';
  if (severity === '重度') return 'rgb(234 88 12)';
  if (severity === '中度') return 'rgb(234 179 8)';
  return 'rgb(148 163 184)';
};

const severityTagColor = (severity: Severity) => {
  if (severity === '危急' || severity === '重度') return 'red';
  if (severity === '中度') return 'orange';
  return 'gray';
};

const save = (status: SummaryRecord['status']) => {
  const target = caseItem.value;
  if (!target) return;
  const payload: SummaryRecord = {
    id: record.value?.id ?? `summary-${target.id}`,
    caseId: target.id,
    patientName: target.patientName,
    anesthesiaMethod: target.anesthesiaMethod,
    ...form,
    status,
    signedAt: status === '已提交' ? dayjs().toISOString() : record.value?.signedAt,
  };
  store.saveSummaryRecord(payload);
  Message.success(status === '已提交' ? '麻醉小结已提交' : '草稿已保存');
};
</script>

<style scoped>
.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.summary-grid__full {
  grid-column: 1 / -1;
}

.inline-flags {
  margin-top: var(--space-3);
}

.fluid-stat-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.fluid-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
}

.fluid-stat__label {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.fluid-stat strong {
  font-size: var(--font-size-lg);
  color: var(--text-primary);
}

.blood-table {
  margin-top: var(--space-2);
}

.event-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.event-treatment {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.event-treatment--missing {
  color: var(--danger);
}

.quality-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-3);
}

.quality-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
}

.quality-item--ok {
  border-color: var(--color-success-100);
  background: var(--color-success-100);
}

.quality-item--warn {
  border-color: var(--color-warning-100);
  background: rgb(255 247 237);
}

.quality-item--ok :deep(svg) {
  color: var(--color-success-600);
}

.quality-item--warn :deep(svg) {
  color: var(--warning);
}

.quality-item--na :deep(svg) {
  color: var(--text-tertiary);
}

.quality-item__label {
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.quality-item__detail {
  margin-top: 2px;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.vital-extremes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin-top: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px dashed var(--border);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
}

.form-actions {
  margin-top: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border);
}

@media (max-width: 1100px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }

  .fluid-stat-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
