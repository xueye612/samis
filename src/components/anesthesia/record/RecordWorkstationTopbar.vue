<template>
  <section class="record-workstation-topbar no-print">
    <div class="topbar-left">
      <a-button class="return-button" size="mini" @click="$emit('go-back')">
        {{ returnLabel }}
      </a-button>
      <h1 class="page-title">麻醉记录单</h1>
      <div class="patient-context">
        <span class="ctx-room">{{ record?.room }}</span>
        <strong class="ctx-name">{{ record?.patientName }}</strong>
        <span class="ctx-surgery">{{ record?.surgeryName }}</span>
      </div>
      <a-tag size="small" :color="statusTag.color">{{ statusTag.label }}</a-tag>
      <span v-if="deviceCollecting" class="collecting-hint">采集中</span>
      <a-button
        v-if="actions.showConflictAction && syncState.conflictCount > 0"
        size="mini"
        type="outline"
        status="danger"
        @click="$emit('open-conflicts')"
      >
        冲突 {{ syncState.conflictCount }}
      </a-button>
    </div>

    <div class="topbar-center">
      <a-button-group size="mini">
        <a-button @click="$emit('decrease-zoom')">−</a-button>
        <a-button disabled class="zoom-label">{{ zoomPercent }}%</a-button>
        <a-button @click="$emit('increase-zoom')">+</a-button>
      </a-button-group>
      <a-button size="mini" @click="$emit('fit-width')">适宽</a-button>
      <a-select
        :model-value="selectedCaseId"
        size="mini"
        class="case-switch"
        placeholder="切换病例"
        popup-container="body"
        :options="caseOptions"
        @update:model-value="(value) => $emit('select-case', String(value))"
      />
      <span v-if="pageCount > 1" class="aux-chip">{{ pageCount }}页</span>
      <span class="meta-datetime" :title="nowLabel">{{ nowLabel }}</span>
      <span v-if="currentUserName" class="meta-user" :title="`当前操作者：${currentUserName}`">
        {{ currentUserName }}
      </span>
    </div>

    <div class="topbar-right">
      <RecordStatusBar
        inline
        :sync-state="syncState"
        @open-sync-detail="$emit('open-sync-detail')"
        @open-conflicts="$emit('open-conflicts')"
      />

      <div class="clinical-actions">
        <a-button
          v-if="actions.primaryAction !== 'none'"
          size="small"
          :type="actions.primaryType"
          :status="actions.primaryAction === 'end' ? 'danger' : undefined"
          @click="$emit('primary-action')"
        >
          {{ actions.primaryLabel }}
        </a-button>
        <a-button
          v-else
          size="small"
          :type="actions.primaryType"
          disabled
        >
          {{ actions.primaryLabel }}
        </a-button>

        <a-button v-if="actions.showSaveDraft" size="small" @click="$emit('save-draft')">保存</a-button>
        <a-button v-if="actions.showRescue" size="small" status="danger" @click="$emit('enter-rescue')">抢救</a-button>
        <a-button v-if="actions.showExitRescue" size="small" status="warning" @click="$emit('exit-rescue')">退出抢救</a-button>
        <a-button
          v-if="actions.showSubmitSignature"
          size="small"
          type="primary"
          status="success"
          @click="$emit('submit-signature')"
        >
          提交签名
        </a-button>
        <a-button v-if="actions.showUnlock" size="small" type="outline" @click="$emit('unlock')">申请修改</a-button>
        <a-button v-if="actions.showPrint" size="small" @click="$emit('print')">打印</a-button>

        <a-dropdown trigger="click">
          <a-button size="small">更多</a-button>
          <template #content>
            <a-doption v-if="actions.showQualityCheck" @click="$emit('quality-check')">完整性检查</a-doption>
            <a-doption @click="$emit('section-settings')">纸面显示设置</a-doption>
            <a-doption @click="$emit('toggle-patient-queue')">
              {{ patientPanelOpen ? '隐藏患者队列' : '显示患者队列' }}
            </a-doption>
            <a-doption @click="$emit('toggle-quality-panel')">
              {{ qualityPanelOpen ? '隐藏质控侧栏' : '显示质控侧栏' }}
            </a-doption>
            <a-doption v-if="actions.showUnlock" @click="$emit('unlock')">解锁修改</a-doption>
          </template>
        </a-dropdown>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import RecordStatusBar from '@/components/anesthesia/record/RecordStatusBar.vue';
import {
  buildRecordActionVisibility,
  recordStatusTagMeta,
  type RecordActionVisibility,
} from '@/services/anesthesia/recordActionRules';
import type { AnesthesiaSyncState } from '@/types/anesthesiaLocalDb';
import type { SurgeryCase } from '@/types/anesthesia';

const props = defineProps<{
  record?: SurgeryCase;
  returnLabel: string;
  syncState: AnesthesiaSyncState;
  selectedCaseId: string;
  caseOptions: Array<{ label: string; value: string }>;
  zoomPercent: number;
  pageCount: number;
  locked: boolean;
  rescueActive: boolean;
  deviceCollecting?: boolean;
  patientPanelOpen: boolean;
  qualityPanelOpen: boolean;
  currentUserName?: string;
  actions?: RecordActionVisibility;
}>();

defineEmits<{
  'go-back': [];
  'primary-action': [];
  'save-draft': [];
  'enter-rescue': [];
  'exit-rescue': [];
  'submit-signature': [];
  unlock: [];
  print: [];
  'quality-check': [];
  'section-settings': [];
  'toggle-patient-queue': [];
  'toggle-quality-panel': [];
  'decrease-zoom': [];
  'increase-zoom': [];
  'fit-width': [];
  'select-case': [id: string];
  'open-sync-detail': [];
  'open-conflicts': [];
}>();

const actions = computed(() => (
  props.actions ?? buildRecordActionVisibility(props.record, props.rescueActive)
));

const statusTag = computed(() => recordStatusTagMeta(actions.value.phase, props.record));

const nowLabel = ref(dayjs().format('YYYY-MM-DD HH:mm'));
let clockTimer: ReturnType<typeof setInterval> | undefined;

const tickClock = () => {
  nowLabel.value = dayjs().format('YYYY-MM-DD HH:mm');
};

onMounted(() => {
  tickClock();
  clockTimer = setInterval(tickClock, 30_000);
});

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer);
});
</script>

<style scoped>
.record-workstation-topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.97);
  box-shadow: var(--shadow-sm);
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
}

.topbar-center {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.return-button {
  flex-shrink: 0;
  color: var(--primary);
  background: var(--primary-soft);
}

.page-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
}

.patient-context {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.ctx-room {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--surface-muted);
  color: var(--text-tertiary);
  font-size: 11px;
}

.ctx-name {
  flex-shrink: 0;
  color: var(--text-primary);
  font-size: 13px;
}

.ctx-surgery {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: min(200px, 20vw);
}

.collecting-hint {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--color-success-50);
  color: var(--color-success-600);
  font-size: 11px;
}

.case-switch {
  width: min(168px, 18vw);
  min-width: 120px;
}

.zoom-label {
  min-width: 40px;
  font-variant-numeric: tabular-nums;
}

.aux-chip {
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-tertiary);
  font-size: 11px;
  white-space: nowrap;
}

.meta-datetime {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.meta-user {
  flex-shrink: 0;
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--border);
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
}

.clinical-actions {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 4px;
}

@media (max-width: 1280px) {
  .ctx-surgery {
    display: none;
  }
}

@media (max-width: 1100px) {
  .patient-context {
    display: none;
  }
}
</style>
