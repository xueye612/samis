<template>
  <ModulePageShell
    title="术后随访管理"
    description="OperationCase 真值、麻醉随访与护理访视只读联动"
    ><template #toolbar
      ><a-select
        v-model="operationId"
        :options="caseOptions"
        style="width: 320px"
      /><a-button :loading="loading" @click="load">刷新</a-button
      ><a-button v-if="canManage" type="primary" @click="openEditor">{{
        detail?.followup ? "修订草稿" : "新增随访"
      }}</a-button></template
    ><a-alert v-if="error" type="error">{{ error }}</a-alert
    ><a-empty
      v-else-if="!operationId"
      description="暂无真实手术病例" /><template v-else-if="detail"
      ><a-card title="手术病例（只读）"
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
          ><a-descriptions-item label="随访状态">{{
            detail.followup?.status ?? "未保存"
          }}</a-descriptions-item
          ><a-descriptions-item label="版本">{{
            detail.followup?.version ?? 0
          }}</a-descriptions-item></a-descriptions
        ><a-space v-if="canManage" style="margin-top: 12px"
          ><a-button
            type="primary"
            :disabled="detail.followup?.status !== 'draft'"
            @click="submitCurrent"
            >提交</a-button
          ><a-button
            :disabled="detail.followup?.status !== 'submitted'"
            @click="cancelCurrent"
            >撤回</a-button
          ></a-space
        ></a-card
      ><a-card title="护理术后访视摘要（HULI只读）"
        ><a-descriptions :column="3"
          ><a-descriptions-item label="来源">{{
            detail.nursingVisitSummary?.source ?? "huli"
          }}</a-descriptions-item
          ><a-descriptions-item label="状态">{{
            detail.nursingVisitSummary?.status ?? "missing"
          }}</a-descriptions-item
          ><a-descriptions-item label="时间">{{
            detail.nursingVisitSummary?.occurredAt ?? "-"
          }}</a-descriptions-item></a-descriptions
        ></a-card
      ><a-card title="麻醉随访"
        ><a-empty
          v-if="!detail.followup"
          description="尚无麻醉随访"
        /><a-descriptions v-else :column="3" bordered
          ><a-descriptions-item label="随访时间">{{
            detail.followup.followupAt ?? "-"
          }}</a-descriptions-item
          ><a-descriptions-item label="方式">{{
            detail.followup.followupMethod ?? "-"
          }}</a-descriptions-item
          ><a-descriptions-item label="VAS">{{
            detail.followup.painScore ?? "-"
          }}</a-descriptions-item
          ><a-descriptions-item label="满意度">{{
            detail.followup.satisfaction ?? "-"
          }}</a-descriptions-item
          ><a-descriptions-item label="备注">{{
            detail.followup.notes ?? "-"
          }}</a-descriptions-item></a-descriptions
        ></a-card
      ></template
    ><a-modal v-model:visible="visible" title="麻醉术后随访" @ok="save"
      ><a-form :model="form" layout="vertical"
        ><a-form-item label="随访时间"
          ><a-date-picker
            v-model="form.followupAt"
            show-time
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%" /></a-form-item
        ><a-form-item label="随访方式"
          ><a-input v-model="form.followupMethod" /></a-form-item
        ><a-form-item label="VAS"
          ><a-input-number
            v-model="form.painScore"
            :min="0"
            :max="10" /></a-form-item
        ><a-form-item label="满意度"
          ><a-input-number
            v-model="form.satisfaction"
            :min="0"
            :max="5"
            :step="0.5" /></a-form-item
        ><a-form-item label="备注"
          ><a-textarea v-model="form.notes" /></a-form-item></a-form></a-modal
  ></ModulePageShell>
</template>
<script setup lang="ts">
import dayjs from "dayjs";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { Message } from "@arco-design/web-vue";
import ModulePageShell from "@/components/shared/ModulePageShell.vue";
import { authApi } from "@/api/auth";
import type { OperationCase } from "@/services/anesthesia/adapters/operationInfoAdapter";
import { loadOperationCases } from "@/services/preoperative/preoperativeFiveFlowsService";
import {
  cancelFollowup,
  hasPostoperativePermission,
  loadPostoperativeDetail,
  saveFollowupDraft,
  submitFollowup,
  type PostoperativeDetail,
} from "@/services/anesthesia/postoperativeWorkflow";
const cases = ref<OperationCase[]>([]),
  permissions = ref<string[]>([]),
  operationId = ref(""),
  detail = ref<PostoperativeDetail | null>(null),
  loading = ref(false),
  error = ref(""),
  visible = ref(false);
const form = reactive({
  followupAt: "",
  followupMethod: "门诊/电话",
  painScore: 0,
  satisfaction: 5,
  notes: "",
});
const canManage = computed(() =>
  hasPostoperativePermission(permissions.value, "postop.followup.manage"),
);
const caseOptions = computed(() =>
  cases.value.map((c) => ({
    label: `${c.patientName ?? "-"} · ${c.operationName ?? "-"} · ${c.operationDate ?? "-"}`,
    value: String(c.operationId),
  })),
);
async function load() {
  if (!operationId.value) return;
  loading.value = true;
  error.value = "";
  try {
    detail.value = await loadPostoperativeDetail(operationId.value);
  } catch (e) {
    detail.value = null;
    error.value = e instanceof Error ? e.message : "加载失败";
  } finally {
    loading.value = false;
  }
}
function openEditor() {
  const f = detail.value?.followup;
  form.followupAt = f?.followupAt ?? dayjs().format("YYYY-MM-DD HH:mm:ss");
  form.followupMethod = f?.followupMethod ?? "门诊/电话";
  form.painScore = f?.painScore ?? 0;
  form.satisfaction = f?.satisfaction ?? 5;
  form.notes = f?.notes ?? "";
  visible.value = true;
}
async function save() {
  const f = detail.value?.followup;
  detail.value = await saveFollowupDraft({
    operationId: operationId.value,
    followupId: f?.followupId,
    expectedVersion: f?.version ?? 0,
    ...form,
  });
  visible.value = false;
  Message.success("保存并回读成功");
}
async function submitCurrent() {
  const f = detail.value?.followup;
  if (f) detail.value = await submitFollowup(operationId.value, f.version);
}
async function cancelCurrent() {
  const f = detail.value?.followup;
  if (f)
    detail.value = await cancelFollowup(
      operationId.value,
      f.version,
      "页面撤回修订",
    );
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
  operationId.value = String(c[0]?.operationId ?? "");
});
watch(operationId, () => void load());
</script>
