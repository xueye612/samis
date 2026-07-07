<template>
  <ModulePageShell title="PACU 预约" description="术后 PACU 床位预约与接收状态">
    <template #chips>
      <a-tag color="arcoblue">预约 {{ store.pacuBookings.length }}</a-tag>
      <a-tag :color="store.pacuBookingsSource === 'remote' ? 'green' : 'gray'">
        {{ store.pacuBookingsSource === 'remote' ? '真实数据' : '本地数据' }}
      </a-tag>
    </template>
    <template #toolbar>
      <a-space>
        <a-button @click="refresh">刷新</a-button>
        <a-button type="primary" @click="openCreate">新增预约</a-button>
      </a-space>
    </template>
    <a-card class="section-card" :bordered="false" title="预约列表">
      <a-table :data="store.pacuBookings" row-key="id" :pagination="{ pageSize: 10 }">
        <template #columns>
          <a-table-column title="患者" data-index="patientName" :width="100" />
          <a-table-column title="复苏室" :width="120">
            <template #cell="{ record }">{{ roomName(record.pacuRoomId) }}</template>
          </a-table-column>
          <a-table-column title="床位" data-index="bedId" :width="90" />
          <a-table-column title="预约时间" data-index="bookingTime" :width="160" />
          <a-table-column title="预约医师" data-index="bookingDoctor" />
          <a-table-column title="类型" data-index="bookingType" :width="110" />
          <a-table-column title="状态" :width="100">
            <template #cell="{ record }">
              <a-tag :color="statusColor(record.status)">{{ record.status }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="200" fixed="right">
            <template #cell="{ record }">
              <a-space>
                <a-button size="mini" @click="openEdit(record)" :disabled="record.status !== '待接收'">编辑</a-button>
                <a-button
                  size="mini"
                  status="danger"
                  @click="onCancel(record)"
                  :disabled="record.status !== '待接收'"
                >取消</a-button>
                <a-button size="mini" type="primary" @click="goCase(record.caseId)">病例</a-button>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>
    <a-modal
      v-model:visible="visible"
      :title="editingId ? '编辑预约' : '新增预约'"
      width="600px"
      :ok-loading="saving"
      @ok="save"
    >
      <a-form :model="form" layout="vertical">
        <a-form-item label="关联病例" required>
          <a-select
            v-model="form.caseId"
            :options="caseOptions"
            placeholder="选择患者"
            :disabled="!!editingId"
          />
        </a-form-item>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="复苏室" required>
              <a-select v-model="form.pacuRoomId" :options="roomOptions" placeholder="选择 PACU 房间" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="床位（可选）">
              <a-input v-model="form.bedId" placeholder="如 A-01" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="预约时间" required>
              <a-date-picker
                v-model="form.bookingTime"
                format="YYYY-MM-DD HH:mm:ss"
                show-time
                value-format="YYYY-MM-DD HH:mm:ss"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="类型" required>
              <a-select v-model="form.bookingType" :options="['常规预约', '紧急预约']" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="预约医师"><a-input v-model="form.bookingDoctor" /></a-form-item>
      </a-form>
    </a-modal>
  </ModulePageShell>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Message } from '@arco-design/web-vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { PacuBooking } from '@/types/clinicalModules';

const store = useAnesthesiaStore();
const router = useRouter();
const visible = ref(false);
const saving = ref(false);
const editingId = ref('');

const form = reactive({
  caseId: '',
  pacuRoomId: '',
  bedId: '',
  bookingTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  bookingDoctor: '',
  bookingType: '常规预约' as PacuBooking['bookingType'],
});

const caseOptions = computed(() =>
  store.cases.map((item) => ({ label: `${item.patientName} · ${item.surgeryName}`, value: item.id })),
);
const roomOptions = computed(() =>
  store.pacuRooms.map((item) => ({ label: item.name, value: item.id })),
);

const roomName = (roomId: string) => store.pacuRooms.find((r) => r.id === roomId)?.name ?? roomId ?? '';
const statusColor = (status: PacuBooking['status']) =>
  ({ 待接收: 'orange', 已接收: 'green', 已取消: 'gray' })[status] ?? 'gray';
const goCase = (caseId: string) => router.push(`/surgery/detail/${caseId}`);

const resetForm = () => {
  form.caseId = store.cases[0]?.id ?? '';
  form.pacuRoomId = store.pacuRooms[0]?.id ?? '';
  form.bedId = '';
  form.bookingTime = dayjs().format('YYYY-MM-DD HH:mm:ss');
  form.bookingDoctor = '';
  form.bookingType = '常规预约';
};

const openCreate = () => {
  editingId.value = '';
  resetForm();
  visible.value = true;
};

const openEdit = (record: PacuBooking) => {
  editingId.value = record.id;
  form.caseId = record.caseId;
  form.pacuRoomId = record.pacuRoomId;
  form.bedId = record.bedId ?? '';
  form.bookingTime = record.bookingTime;
  form.bookingDoctor = record.bookingDoctor;
  form.bookingType = record.bookingType;
  visible.value = true;
};

const save = async () => {
  if (!form.caseId) {
    Message.warning('请选择关联病例');
    return;
  }
  if (!form.pacuRoomId) {
    Message.warning('请选择复苏室');
    return;
  }
  if (!form.bookingTime) {
    Message.warning('请选择预约时间');
    return;
  }
  const patient = store.cases.find((item) => item.id === form.caseId);
  saving.value = true;
  try {
    if (editingId.value) {
      const patch: Partial<PacuBooking> = {
        pacuRoomId: form.pacuRoomId,
        bedId: form.bedId || undefined,
        bookingTime: form.bookingTime,
        bookingDoctor: form.bookingDoctor,
        bookingType: form.bookingType,
      };
      await store.updatePacuBooking(editingId.value, patch);
      Message.success('预约已更新');
    } else {
      const payload: PacuBooking = {
        id: `bk-${Date.now()}`,
        caseId: form.caseId,
        patientName: patient?.patientName ?? '',
        pacuRoomId: form.pacuRoomId,
        bedId: form.bedId || undefined,
        bookingTime: form.bookingTime,
        bookingDoctor: form.bookingDoctor,
        bookingType: form.bookingType,
        status: '待接收',
      };
      await store.createPacuBooking(payload);
      Message.success('预约已创建');
    }
    visible.value = false;
  } catch (error) {
    Message.error(error instanceof Error ? error.message : '保存预约失败');
  } finally {
    saving.value = false;
  }
};

const onCancel = async (record: PacuBooking) => {
  try {
    await store.cancelPacuBooking(record.id);
    Message.success('预约已取消');
  } catch (error) {
    Message.error(error instanceof Error ? error.message : '取消预约失败');
  }
};

const refresh = async () => {
  await store.loadRemotePacuBookings();
  Message.success('已刷新');
};

onMounted(() => {
  void store.loadRemotePacuBookings();
});
</script>
