<template>
  <ModulePageShell
    title="并发症追踪"
    description="麻醉并发症真实上报、版本与作废闭环"
    ><template #toolbar
      ><a-select
        v-model="operationId"
        :options="caseOptions"
        style="width: 320px"
      /><a-button @click="load">刷新</a-button
      ><a-button v-if="canManage" type="primary" @click="openCreate"
        >登记</a-button
      ></template
    ><a-alert v-if="error" type="error">{{ error }}</a-alert
    ><a-card v-if="detail" title="OperationCase（只读）"
      ><div>
        {{ detail.operationCase.patientName ?? "-" }} ·
        {{ detail.operationCase.operationName ?? "-" }} ·
        {{ detail.operationCase.operationDate ?? "-" }}
      </div></a-card
    ><a-card v-if="detail" title="并发症记录"
      ><a-table
        :data="detail.complications"
        row-key="complicationId"
        :pagination="false"
        ><template #columns
          ><a-table-column
            title="类型"
            data-index="complicationType"
          /><a-table-column
            title="严重度"
            data-index="severity"
          /><a-table-column
            title="发生时间"
            data-index="occurredAt"
          /><a-table-column
            title="状态"
            data-index="reportStatus"
          /><a-table-column title="版本" data-index="version" /><a-table-column
            title="操作"
            ><template #cell="{ record }"
              ><a-space v-if="canManage"
                ><a-button
                  size="mini"
                  :disabled="record.reportStatus !== 'draft'"
                  @click="edit(record)"
                  >编辑</a-button
                ><a-button
                  size="mini"
                  type="primary"
                  :disabled="record.reportStatus !== 'draft'"
                  @click="report(record)"
                  >上报</a-button
                ><a-button
                  size="mini"
                  status="danger"
                  :disabled="record.reportStatus === 'voided'"
                  @click="voidRow(record)"
                  >作废</a-button
                ></a-space
              ></template
            ></a-table-column
          ></template
        ></a-table
      ><a-empty
        v-if="!detail.complications.length"
        description="暂无真实并发症记录" /></a-card
    ><a-modal v-model:visible="visible" title="并发症" @ok="save"
      ><a-form :model="form" layout="vertical"
        ><a-form-item label="类型"
          ><a-input v-model="form.complicationType" /></a-form-item
        ><a-form-item label="严重度"
          ><a-select
            v-model="form.severity"
            :options="[
              'mild',
              'moderate',
              'severe',
              'life_threatening',
            ]" /></a-form-item
        ><a-form-item label="发生时间"
          ><a-date-picker
            v-model="form.occurredAt"
            show-time
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%" /></a-form-item
        ><a-form-item label="描述"
          ><a-textarea v-model="form.description" /></a-form-item
        ><a-form-item label="处理"
          ><a-textarea v-model="form.treatment" /></a-form-item
        ><a-form-item label="转归"
          ><a-input v-model="form.outcome" /></a-form-item></a-form></a-modal
  ></ModulePageShell>
</template>
<script setup lang="ts">
import dayjs from "dayjs";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { Message, Modal } from "@arco-design/web-vue";
import ModulePageShell from "@/components/shared/ModulePageShell.vue";
import { authApi } from "@/api/auth";
import type { OperationCase } from "@/services/anesthesia/adapters/operationInfoAdapter";
import { loadOperationCases } from "@/services/preoperative/preoperativeFiveFlowsService";
import {
  hasPostoperativePermission,
  loadPostoperativeDetail,
  reportComplication,
  saveComplication,
  voidComplication,
  type PostoperativeDetail,
} from "@/services/anesthesia/postoperativeWorkflow";
import type { PostoperativeComplicationContract } from "@/api/postoperative";
const cases = ref<OperationCase[]>([]),
  permissions = ref<string[]>([]),
  operationId = ref(""),
  detail = ref<PostoperativeDetail | null>(null),
  error = ref(""),
  visible = ref(false),
  editing = ref<PostoperativeComplicationContract | null>(null);
const form = reactive({
  complicationType: "",
  severity: "moderate" as PostoperativeComplicationContract["severity"],
  occurredAt: "",
  description: "",
  treatment: "",
  outcome: "",
});
const canManage = computed(() =>
  hasPostoperativePermission(permissions.value, "postop.complication.manage"),
);
const caseOptions = computed(() =>
  cases.value.map((c) => ({
    label: `${c.patientName ?? "-"} · ${c.operationName ?? "-"} · ${c.operationDate ?? "-"}`,
    value: String(c.operationId),
  })),
);
async function load() {
  if (!operationId.value) return;
  try {
    detail.value = await loadPostoperativeDetail(operationId.value);
    error.value = "";
  } catch (e) {
    detail.value = null;
    error.value = e instanceof Error ? e.message : "加载失败";
  }
}
function openCreate() {
  editing.value = null;
  Object.assign(form, {
    complicationType: "",
    severity: "moderate",
    occurredAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    description: "",
    treatment: "",
    outcome: "",
  });
  visible.value = true;
}
function edit(r: PostoperativeComplicationContract) {
  editing.value = r;
  Object.assign(form, {
    complicationType: r.complicationType,
    severity: r.severity,
    occurredAt: r.occurredAt ?? "",
    description: r.description ?? "",
    treatment: r.treatment ?? "",
    outcome: r.outcome ?? "",
  });
  visible.value = true;
}
async function save() {
  detail.value = await saveComplication({
    operationId: operationId.value,
    complicationId: editing.value?.complicationId,
    expectedVersion: editing.value?.version ?? 0,
    ...form,
  });
  visible.value = false;
  Message.success("保存并回读成功");
}
async function report(r: PostoperativeComplicationContract) {
  detail.value = await reportComplication(
    operationId.value,
    r.complicationId,
    r.version,
  );
}
function voidRow(r: PostoperativeComplicationContract) {
  Modal.confirm({
    title: "作废并发症",
    content: "确认按误报作废？",
    onOk: async () => {
      detail.value = await voidComplication(
        operationId.value,
        r.complicationId,
        r.version,
        "页面确认误报",
      );
    },
  });
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
