<template>
  <ModulePageShell
    title="PACU转出管理"
    description="按OperationCase加载真实PACU状态"
    ><template #toolbar><a-button @click="load">刷新</a-button></template
    ><a-alert v-if="error" type="error">{{ error }}</a-alert
    ><a-table :data="rows" row-key="operationId"
      ><template #columns
        ><a-table-column title="患者"
          ><template #cell="{ record }">{{
            record.operationCase.patientName ?? "-"
          }}</template></a-table-column
        ><a-table-column title="手术"
          ><template #cell="{ record }">{{
            record.operationCase.operationName ?? "-"
          }}</template></a-table-column
        ><a-table-column title="状态"
          ><template #cell="{ record }">{{
            record.pacuRecord?.status ?? "未入室"
          }}</template></a-table-column
        ><a-table-column title="版本"
          ><template #cell="{ record }">{{
            record.pacuRecord?.version ?? 0
          }}</template></a-table-column
        ><a-table-column title="入室"
          ><template #cell="{ record }">{{
            record.pacuRecord?.admittedAt ?? "-"
          }}</template></a-table-column
        ><a-table-column title="出室"
          ><template #cell="{ record }">{{
            record.pacuRecord?.dischargedAt ?? "-"
          }}</template></a-table-column
        ><a-table-column title="操作"
          ><template #cell="{ record }"
            ><a-button
              type="primary"
              @click="
                router.push(
                  `/pacu/record/${record.operationCase.operationId}?operationId=${record.operationCase.operationId}`,
                )
              "
              >恢复/转出记录</a-button
            ></template
          ></a-table-column
        ></template
      ></a-table
    ><a-empty v-if="!rows.length && !error" description="暂无真实PACU记录"
  /></ModulePageShell>
</template>
<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import ModulePageShell from "@/components/shared/ModulePageShell.vue";
import { loadOperationCases } from "@/services/preoperative/preoperativeFiveFlowsService";
import {
  pacuDetail,
  type PacuDetailContract,
} from "@/services/anesthesia/pacuWorkflow";
const router = useRouter(),
  rows = ref<PacuDetailContract[]>([]),
  error = ref("");
async function load() {
  try {
    const cases = await loadOperationCases();
    rows.value = (
      await Promise.all(
        cases
          .filter((c) => Boolean(c.operationId))
          .map((c) => pacuDetail(String(c.operationId)).catch(() => null)),
      )
    ).filter((x): x is PacuDetailContract => Boolean(x?.pacuRecord));
    error.value = "";
  } catch (e) {
    rows.value = [];
    error.value = e instanceof Error ? e.message : "加载失败";
  }
}
onMounted(() => void load());
</script>
