<template>
  <ModulePageShell title="用户管理" description="系统用户账号与角色配置">
    <template #toolbar>
      <a-button type="primary" @click="openCreate">新增用户</a-button>
    </template>
    <a-card class="section-card" :bordered="false" title="用户列表">
      <a-table :data="store.systemUsers" row-key="id" :pagination="{ pageSize: 10 }">
        <template #columns>
          <a-table-column title="用户名" data-index="username" />
          <a-table-column title="姓名" data-index="name" />
          <a-table-column title="角色" :width="140">
            <template #cell="{ record }">{{ roleLabel(record.role) }}</template>
          </a-table-column>
          <a-table-column title="科室" data-index="department" />
          <a-table-column title="状态" :width="90">
            <template #cell="{ record }">
              <a-tag :color="record.active ? 'green' : 'gray'">{{ record.active ? '启用' : '停用' }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="120" fixed="right">
            <template #cell="{ record }">
              <a-button size="mini" @click="openEdit(record)">编辑</a-button>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>
    <a-modal v-model:visible="visible" :title="editingId ? '编辑用户' : '新增用户'" @ok="save">
      <a-form :model="form" layout="vertical">
        <a-form-item label="用户名" required><a-input v-model="form.username" /></a-form-item>
        <a-form-item label="姓名" required><a-input v-model="form.name" /></a-form-item>
        <a-form-item label="角色">
          <a-select v-model="form.role" :options="roleOptions" />
        </a-form-item>
        <a-form-item label="科室"><a-input v-model="form.department" /></a-form-item>
        <a-form-item label="启用"><a-switch v-model="form.active" /></a-form-item>
      </a-form>
    </a-modal>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { SystemUser } from '@/types/system';

const store = useAnesthesiaStore();
const visible = ref(false);
const editingId = ref('');

const roleOptions = [
  { label: '管理员', value: 'admin' },
  { label: '麻醉医师', value: 'anesthesiologist' },
  { label: '护士', value: 'nurse' },
  { label: '只读', value: 'viewer' },
];

const roleLabel = (role: SystemUser['role']) => roleOptions.find((o) => o.value === role)?.label ?? role;

const form = reactive({
  username: '',
  name: '',
  role: 'anesthesiologist' as SystemUser['role'],
  department: '麻醉科',
  active: true,
});

const openCreate = () => {
  editingId.value = '';
  form.username = '';
  form.name = '';
  form.role = 'anesthesiologist';
  form.department = '麻醉科';
  form.active = true;
  visible.value = true;
};

const openEdit = (user: SystemUser) => {
  editingId.value = user.id;
  form.username = user.username;
  form.name = user.name;
  form.role = user.role;
  form.department = user.department;
  form.active = user.active;
  visible.value = true;
};

const save = () => {
  if (!form.username.trim() || !form.name.trim()) {
    Message.warning('请填写用户名和姓名');
    return;
  }
  store.saveSystemUser({
    id: editingId.value || `u-${Date.now()}`,
    username: form.username.trim(),
    name: form.name.trim(),
    role: form.role,
    department: form.department,
    active: form.active,
  });
  Message.success('用户已保存');
  visible.value = false;
};
</script>
