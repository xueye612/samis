<template>
  <ModulePageShell
    title="PACU接收"
    description="预约接收、床位占用与护理摘要只读核对"
    ><template #toolbar><a-button @click="load">刷新</a-button></template
    ><a-alert v-if="error" type="error">{{ error }}</a-alert
    ><a-card title="待接收预约"
      ><a-table :data="bookings" row-key="bookingId" :pagination="false"
        ><template #columns
          ><a-table-column title="患者"
            ><template #cell="{ record }">{{
              record.operationCase?.patientName ?? "-"
            }}</template></a-table-column
          ><a-table-column title="手术"
            ><template #cell="{ record }">{{
              record.operationCase?.operationName ?? "-"
            }}</template></a-table-column
          ><a-table-column
            title="预约时间"
            data-index="bookingTime"
          /><a-table-column title="版本" data-index="version" /><a-table-column
            title="操作"
            ><template #cell="{ record }"
              ><a-button v-if="canManage" type="primary" @click="select(record)"
                >接收入室</a-button
              ></template
            ></a-table-column
          ></template
        ></a-table
      ><a-empty v-if="!bookings.length" description="暂无待接收预约" /></a-card
    ><a-card title="可用床位"
      ><a-table :data="beds" row-key="bedId" :pagination="false"
        ><template #columns
          ><a-table-column title="房间" data-index="roomId" /><a-table-column
            title="床号"
            data-index="bedNo" /><a-table-column
            title="状态"
            data-index="status" /><a-table-column
            title="版本"
            data-index="version" /></template></a-table></a-card
    ><a-modal v-model:visible="visible" title="确认PACU入室" @ok="admit"
      ><a-form :model="form" layout="vertical"
        ><a-form-item label="床位"
          ><a-select v-model="form.bedId" :options="bedOptions" /></a-form-item
        ><a-form-item label="护士"><a-input v-model="form.nurse" /></a-form-item
        ><a-form-item label="备注"
          ><a-textarea v-model="form.notes" /></a-form-item></a-form></a-modal
    ><a-card v-if="detail" title="护理交接摘要（HULI只读）"
      ><a-descriptions :column="3"
        ><a-descriptions-item label="来源">{{
          detail.nursingSummary?.source ?? "huli"
        }}</a-descriptions-item
        ><a-descriptions-item label="安全核查">{{
          (detail.nursingSummary?.safetyCheck as any)?.status ?? "missing"
        }}</a-descriptions-item
        ><a-descriptions-item label="护理交接">{{
          (detail.nursingSummary?.handover as any)?.status ?? "missing"
        }}</a-descriptions-item></a-descriptions
      ></a-card
    ></ModulePageShell
  >
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { Message } from "@arco-design/web-vue";
import ModulePageShell from "@/components/shared/ModulePageShell.vue";
import { authApi } from "@/api/auth";
import { pacuApi } from "@/api/pacu";
import {
  hasPacuPermission,
  pacuAction,
  type PacuDetailContract,
} from "@/services/anesthesia/pacuWorkflow";
type Booking = {
  bookingId: string;
  operationId: string;
  bookingTime: string;
  version: number;
  operationCase?: Record<string, unknown>;
};
type Bed = {
  bedId: string;
  roomId: string;
  bedNo: string;
  status: string;
  version: number;
};
const bookings = ref<Booking[]>([]),
  beds = ref<Bed[]>([]),
  permissions = ref<string[]>([]),
  selected = ref<Booking | null>(null),
  detail = ref<PacuDetailContract | null>(null),
  visible = ref(false),
  error = ref("");
const form = reactive({ bedId: "", nurse: "", notes: "" });
const canManage = computed(() =>
  hasPacuPermission(permissions.value, "pacu.workflow.manage"),
);
const bedOptions = computed(() =>
  beds.value
    .filter((b) => ["空闲", "预留"].includes(b.status))
    .map((b) => ({ label: `${b.roomId}-${b.bedNo}`, value: b.bedId })),
);
const list = <T,>(r: unknown) =>
  Array.isArray((r as { list?: T[] })?.list) ? (r as { list: T[] }).list : [];
async function load() {
  try {
    const [b, d] = await Promise.all([
      pacuApi.bookingList({ status: "待接收", pageSize: 200 }),
      pacuApi.bedList({ pageSize: 200 }),
    ]);
    bookings.value = list<Booking>(b);
    beds.value = list<Bed>(d);
    error.value = "";
  } catch (e) {
    bookings.value = [];
    beds.value = [];
    error.value = e instanceof Error ? e.message : "PACU资源加载失败";
  }
}
function select(r: Booking) {
  selected.value = r;
  form.bedId = beds.value.find((b) => b.status === "空闲")?.bedId ?? "";
  visible.value = true;
}
async function admit() {
  const booking = selected.value,
    bed = beds.value.find((b) => b.bedId === form.bedId);
  if (!booking || !bed) return;
  detail.value = await pacuAction("admit", {
    operationId: booking.operationId,
    expectedVersion: 0,
    bookingId: booking.bookingId,
    bookingExpectedVersion: booking.version,
    bedId: bed.bedId,
    bedExpectedVersion: bed.version,
    nurse: form.nurse,
    notes: form.notes,
  });
  visible.value = false;
  await load();
  Message.success("接收入室并回读成功");
}
onMounted(async () => {
  const p = await authApi.myPermissions();
  permissions.value = Array.isArray(p?.permissions)
    ? p.permissions.map(String)
    : [];
  await load();
});
</script>
