<template>
  <ModulePageShell
    title="PACU预约"
    description="真实预约、版本、取消原因与OperationCase只读投影"
    ><template #toolbar
      ><a-button @click="load">刷新</a-button
      ><a-button v-if="canManage" type="primary" @click="openCreate"
        >新增预约</a-button
      ></template
    ><a-alert v-if="error" type="error">{{ error }}</a-alert
    ><a-table :data="bookings" row-key="bookingId"
      ><template #columns
        ><a-table-column title="患者"
          ><template #cell="{ record }">{{
            record.operationCase?.patientName ?? "-"
          }}</template></a-table-column
        ><a-table-column title="手术"
          ><template #cell="{ record }">{{
            record.operationCase?.operationName ?? "-"
          }}</template></a-table-column
        ><a-table-column title="日期"
          ><template #cell="{ record }">{{
            record.operationCase?.operationDate ?? "-"
          }}</template></a-table-column
        ><a-table-column
          title="预约时间"
          data-index="bookingTime"
        /><a-table-column
          title="类型"
          data-index="bookingType"
        /><a-table-column title="状态" data-index="status" /><a-table-column
          title="版本"
          data-index="version"
        /><a-table-column title="操作"
          ><template #cell="{ record }"
            ><a-space v-if="canManage"
              ><a-button
                size="mini"
                :disabled="record.status !== '待接收'"
                @click="edit(record)"
                >编辑</a-button
              ><a-button
                size="mini"
                status="danger"
                :disabled="record.status !== '待接收'"
                @click="cancel(record)"
                >取消</a-button
              ></a-space
            ></template
          ></a-table-column
        ></template
      ></a-table
    ><a-empty
      v-if="!bookings.length && !error"
      description="远程暂无PACU预约" /><a-modal
      v-model:visible="visible"
      title="PACU预约"
      @ok="save"
      ><a-form :model="form" layout="vertical"
        ><a-form-item label="手术病例"
          ><a-select
            v-model="form.operationId"
            :options="caseOptions"
            :disabled="!!editing" /></a-form-item
        ><a-form-item label="预约时间"
          ><a-date-picker
            v-model="form.bookingTime"
            show-time
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%" /></a-form-item
        ><a-form-item label="类型"
          ><a-select
            v-model="form.bookingType"
            :options="['常规预约', '紧急预约']" /></a-form-item
        ><a-form-item label="PACU房间"
          ><a-input v-model="form.roomId" /></a-form-item
        ><a-form-item label="预约医师"
          ><a-input v-model="form.bookingDoctor" /></a-form-item
        ><a-form-item label="备注"
          ><a-textarea v-model="form.remark" /></a-form-item></a-form></a-modal
  ></ModulePageShell>
</template>
<script setup lang="ts">
import dayjs from "dayjs";
import { computed, onMounted, reactive, ref } from "vue";
import { Message, Modal } from "@arco-design/web-vue";
import ModulePageShell from "@/components/shared/ModulePageShell.vue";
import { authApi } from "@/api/auth";
import { pacuApi } from "@/api/pacu";
import { loadOperationCases } from "@/services/preoperative/preoperativeFiveFlowsService";
import {
  hasPacuPermission,
  savePacuBooking,
  cancelPacuBooking,
} from "@/services/anesthesia/pacuWorkflow";
import type { OperationCase } from "@/services/anesthesia/adapters/operationInfoAdapter";
type Booking = {
  bookingId: string;
  operationId: string;
  bookingTime: string;
  bookingType: string;
  roomId?: string;
  bookingDoctor?: string;
  remark?: string;
  status: string;
  version: number;
  operationCase?: OperationCase;
};
const cases = ref<OperationCase[]>([]),
  bookings = ref<Booking[]>([]),
  permissions = ref<string[]>([]),
  error = ref(""),
  visible = ref(false),
  editing = ref<Booking | null>(null);
const form = reactive({
  operationId: "",
  bookingTime: "",
  bookingType: "常规预约",
  roomId: "",
  bookingDoctor: "",
  remark: "",
});
const canManage = computed(() =>
  hasPacuPermission(permissions.value, "pacu.resource.manage"),
);
const caseOptions = computed(() =>
  cases.value.filter((c) => Boolean(c.operationId)).map((c) => ({
    label: `${c.patientName ?? "-"} · ${c.operationName ?? "-"} · ${c.operationDate ?? "-"}`,
    value: String(c.operationId),
  })),
);
function rows(raw: unknown) {
  const r = raw as { list?: Booking[] };
  return Array.isArray(r?.list) ? r.list : [];
}
async function load() {
  try {
    bookings.value = rows(await pacuApi.bookingList({ pageSize: 200 }));
    error.value = "";
  } catch (e) {
    bookings.value = [];
    error.value = e instanceof Error ? e.message : "预约加载失败";
  }
}
function openCreate() {
  editing.value = null;
  Object.assign(form, {
    operationId: String(cases.value.find((c) => c.operationId)?.operationId ?? ""),
    bookingTime: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    bookingType: "常规预约",
    roomId: "",
    bookingDoctor: "",
    remark: "",
  });
  visible.value = true;
}
function edit(r: Booking) {
  editing.value = r;
  Object.assign(form, {
    operationId: r.operationId,
    bookingTime: r.bookingTime,
    bookingType: r.bookingType,
    roomId: r.roomId ?? "",
    bookingDoctor: r.bookingDoctor ?? "",
    remark: r.remark ?? "",
  });
  visible.value = true;
}
async function save() {
  await savePacuBooking({
    bookingId: editing.value?.bookingId,
    operationId: form.operationId,
    expectedVersion: editing.value?.version ?? 0,
    bookingTime: form.bookingTime,
    bookingType: form.bookingType,
    roomId: form.roomId,
    bookingDoctor: form.bookingDoctor,
    remark: form.remark,
  });
  visible.value = false;
  await load();
  Message.success("保存并回读成功");
}
function cancel(r: Booking) {
  Modal.confirm({
    title: "取消预约",
    content: "确认取消并记录原因？",
    onOk: async () => {
      await cancelPacuBooking({
        bookingId: r.bookingId,
        operationId: r.operationId,
        expectedVersion: r.version,
        reason: "页面取消预约",
      });
      await load();
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
  await load();
});
</script>
