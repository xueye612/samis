<template>
  <ModulePageShell
    title="PACU恢复记录"
    description="恢复记录、达标、出室与时间轴"
    ><template #toolbar
      ><a-select
        v-model="operationId"
        :options="caseOptions"
        style="width: 320px"
      /><a-button :loading="loading" @click="load">刷新</a-button></template
    ><a-alert v-if="error" type="error">{{ error }}</a-alert
    ><a-card v-if="detail" title="OperationCase（只读）"
      ><a-descriptions :column="3" bordered
        ><a-descriptions-item label="患者">{{
          detail.operationCase.patientName ?? "-"
        }}</a-descriptions-item
        ><a-descriptions-item label="手术">{{
          detail.operationCase.operationName ?? "-"
        }}</a-descriptions-item
        ><a-descriptions-item label="日期">{{
          detail.operationCase.operationDate ?? "-"
        }}</a-descriptions-item
        ><a-descriptions-item label="PACU状态">{{
          record?.status ?? "未入室"
        }}</a-descriptions-item
        ><a-descriptions-item label="版本">{{
          record?.version ?? 0
        }}</a-descriptions-item
        ><a-descriptions-item label="入室时间">{{
          record?.admittedAt ?? "-"
        }}</a-descriptions-item></a-descriptions
      ></a-card
    ><a-card v-if="record" title="恢复记录"
      ><a-form :model="form" layout="vertical"
        ><a-row :gutter="12"
          ><a-col :span="6"
            ><a-form-item label="Aldrete"
              ><a-input-number
                v-model="form.aldreteScore"
                :min="0"
                :max="10" /></a-form-item></a-col
          ><a-col :span="6"
            ><a-form-item label="VAS"
              ><a-input-number
                v-model="form.painScore"
                :min="0"
                :max="10" /></a-form-item></a-col
          ><a-col :span="6"
            ><a-form-item label="氧疗"
              ><a-input v-model="form.oxygenSupport" /></a-form-item></a-col
          ><a-col :span="6"
            ><a-form-item label="气道"
              ><a-input
                v-model="form.airwayStatus" /></a-form-item></a-col></a-row
        ><a-form-item label="备注"
          ><a-textarea v-model="form.notes" /></a-form-item></a-form
      ><a-space v-if="canManage"
        ><a-button
          type="primary"
          :disabled="!['admitted', 'recovering'].includes(record.status)"
          @click="act('saveRecovery')"
          >保存恢复</a-button
        ><a-button
          :disabled="record.status !== 'recovering'"
          @click="act('markReady')"
          >确认达标</a-button
        ><a-button
          :disabled="record.status !== 'ready_to_discharge'"
          @click="act('discharge')"
          >正常出室</a-button
        ><a-button
          v-if="canForce"
          status="danger"
          :disabled="
            !['admitted', 'recovering', 'ready_to_discharge'].includes(
              record.status,
            )
          "
          @click="act('forceDischarge')"
          >强制出室</a-button
        ></a-space
      ></a-card
    ><a-card v-if="detail" title="PACU时间轴"
      ><a-timeline
        ><a-timeline-item
          v-for="item in detail.timeline ?? []"
          :key="String(item.eventId)"
          >{{ item.occurredAt }} · {{ item.eventType }} ·
          {{ item.fromStatus ?? "-" }} → {{ item.toStatus }} · v{{
            item.version
          }}</a-timeline-item
        ></a-timeline
      ></a-card
    ><a-card v-if="detail" title="护理摘要（HULI只读）">
      <pre>{{ detail.nursingSummary }}</pre>
    </a-card></ModulePageShell
  >
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { Message } from "@arco-design/web-vue";
import { useRoute } from "vue-router";
import ModulePageShell from "@/components/shared/ModulePageShell.vue";
import { authApi } from "@/api/auth";
import { loadOperationCases } from "@/services/preoperative/preoperativeFiveFlowsService";
import type { OperationCase } from "@/services/anesthesia/adapters/operationInfoAdapter";
import {
  hasPacuPermission,
  pacuAction,
  pacuDetail,
  type PacuAction,
  type PacuDetailContract,
} from "@/services/anesthesia/pacuWorkflow";
const cases = ref<OperationCase[]>([]),
  permissions = ref<string[]>([]),
  operationId = ref(""),
  detail = ref<PacuDetailContract | null>(null),
  loading = ref(false),
  error = ref("");
const route = useRoute();
const form = reactive({
  aldreteScore: 0,
  painScore: 0,
  oxygenSupport: "",
  airwayStatus: "",
  notes: "",
  dischargeDestination: "病房",
});
const record = computed(() => detail.value?.pacuRecord ?? null);
const canManage = computed(() =>
  hasPacuPermission(permissions.value, "pacu.workflow.manage"),
);
const canForce = computed(() =>
  hasPacuPermission(permissions.value, "pacu.force_discharge"),
);
const caseOptions = computed(() =>
  cases.value.filter((c) => Boolean(c.operationId)).map((c) => ({
    label: `${c.patientName ?? "-"} · ${c.operationName ?? "-"} · ${c.operationDate ?? "-"}`,
    value: String(c.operationId),
  })),
);
async function load() {
  if (!operationId.value) return;
  loading.value = true;
  try {
    detail.value = await pacuDetail(operationId.value);
    const r = record.value;
    if (r)
      Object.assign(form, {
        aldreteScore: r.aldreteScore ?? 0,
        painScore: r.painScore ?? 0,
        oxygenSupport: r.oxygenSupport ?? "",
        airwayStatus: r.airwayStatus ?? "",
        notes: r.notes ?? "",
        dischargeDestination: r.dischargeDestination ?? "病房",
      });
    error.value = "";
  } catch (e) {
    detail.value = null;
    error.value = e instanceof Error ? e.message : "加载失败";
  } finally {
    loading.value = false;
  }
}
async function act(action: PacuAction) {
  const r = record.value;
  if (!r) return;
  const payload: Record<string, unknown> = {
    operationId: operationId.value,
    expectedVersion: r.version,
  };
  if (action === "saveRecovery") Object.assign(payload, form);
  if (action === "markReady")
    Object.assign(payload, {
      dischargeCriteriaMet: true,
      aldreteScore: form.aldreteScore,
    });
  if (action === "discharge")
    Object.assign(payload, { dischargeDestination: form.dischargeDestination });
  if (action === "forceDischarge")
    Object.assign(payload, {
      dischargeDestination: form.dischargeDestination,
      reason: "页面强制出室",
      reasonCode: "MANUAL_OVERRIDE",
    });
  detail.value = await pacuAction(action, payload);
  Message.success("操作并回读成功");
}
onMounted(async () => {
  const [c, p] = await Promise.all([
    loadOperationCases(),
    authApi.myPermissions(),
  ]);
  cases.value = c;
  permissions.value = Array.isArray(p?.permissions)
    ? p.permissions.map(String)
    : [];
  const requested = String(route.query.operationId ?? route.params.id ?? "");
  operationId.value = requested || String(c.find((item) => item.operationId)?.operationId ?? "");
  if (operationId.value) await load();
});
watch(operationId, () => void load());
</script>
