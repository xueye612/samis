<template>
  <ModulePageShell title="用户管理" description="系统用户账号与角色配置">
    <template #toolbar>
      <a-button type="primary" :loading="loading" @click="openCreate">新增用户</a-button>
    </template>
    <a-card class="section-card" :bordered="false" title="用户列表">
      <template #extra>
        <a-tag v-if="sourceLabel" :color="sourceLabel === '远程' ? 'arcoblue' : 'gray'" size="small">数据源：{{ sourceLabel }}</a-tag>
      </template>
      <a-table :data="store.systemUsers" row-key="id" :pagination="{ pageSize: 10 }" :loading="loading">
        <template #columns>
          <a-table-column title="用户名" data-index="username" />
          <a-table-column title="姓名" data-index="name" />
          <a-table-column title="角色" :width="160">
            <template #cell="{ record }">{{ roleLabel(record.role) }}</template>
          </a-table-column>
          <a-table-column title="科室" data-index="department" />
          <a-table-column title="状态" :width="90">
            <template #cell="{ record }">
              <a-tag :color="record.active ? 'green' : 'gray'">{{ record.active ? '启用' : '停用' }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="170" fixed="right">
            <template #cell="{ record }">
              <a-space :size="8">
                <a-button size="mini" @click="openEdit(record)">编辑</a-button>
                <a-popconfirm content="确认删除该用户？" @ok="remove(record)">
                  <a-button size="mini" status="danger">删除</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>
    <a-modal v-model:visible="visible" :title="editingId ? '编辑用户' : '新增用户'" :ok-loading="saving" @ok="save" @cancel="visible = false">
      <a-form :model="form" layout="vertical">
        <a-form-item label="用户名（工号）" required><a-input v-model="form.username" placeholder="登录工号 GH" /></a-form-item>
        <a-form-item label="姓名" required><a-input v-model="form.name" /></a-form-item>
        <a-form-item label="角色">
          <a-select v-model="form.role" :options="roleOptions" :placeholder="roleOptions.length ? '请选择角色' : '暂无角色'" />
        </a-form-item>
        <a-form-item label="科室"><a-input v-model="form.department" /></a-form-item>
        <a-form-item v-if="!editingId" label="初始密码" required>
          <a-input-password v-model="form.password" placeholder="新建用户初始密码" />
        </a-form-item>
        <a-form-item v-else label="重置密码（留空则不修改）">
          <a-input-password v-model="form.password" placeholder="留空保持原密码" />
        </a-form-item>
        <a-form-item label="启用"><a-switch v-model="form.active" /></a-form-item>
      </a-form>
    </a-modal>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import { useRealAdmin } from '@/config/apiFlags';

const store = useAnesthesiaStore();
const visible = ref(false);
const loading = ref(false);
const saving = ref(false);
const editingId = ref<string | number>('');

/** mock 模式兜底枚举（真实模式由远程角色组填充）。 */
const FALLBACK_ROLE_OPTIONS = [
  { label: '管理员', value: 'admin' },
  { label: '麻醉医师', value: 'anesthesiologist' },
  { label: '护士', value: 'nurse' },
  { label: '只读', value: 'viewer' },
];

/** 真实模式=远程角色组（groupid 作 value）；mock 模式=本地枚举。 */
const roleOptions = computed(() => {
  const groups = store.remoteAdminUserGroups;
  if (useRealAdmin() && groups.length) {
    return groups.map((g) => ({ label: g.name, value: g.groupid }));
  }
  return FALLBACK_ROLE_OPTIONS;
});

const groupNameById = computed(() => {
  const map = new Map<string, string>();
  store.remoteAdminUserGroups.forEach((g) => map.set(String(g.groupid), g.name));
  return map;
});

const roleLabel = (role: number | string) => {
  if (typeof role === 'number' || (typeof role === 'string' && /^\d+$/.test(role))) {
    const name = groupNameById.value.get(String(role));
    if (name) return name;
  }
  return FALLBACK_ROLE_OPTIONS.find((o) => o.value === role)?.label ?? String(role);
};

const sourceLabel = computed(() =>
  useRealAdmin() && store.remoteAdminUsersSource === 'remote' ? '远程' : '本地',
);

const form = reactive({
  username: '',
  name: '',
  role: '' as number | string,
  department: '麻醉科',
  active: true,
  password: '',
});

const resetForm = () => {
  editingId.value = '';
  form.username = '';
  form.name = '';
  form.role = roleOptions.value[0]?.value ?? 'anesthesiologist';
  form.department = '麻醉科';
  form.active = true;
  form.password = '';
};

const openCreate = () => {
  resetForm();
  visible.value = true;
};

const openEdit = (user: { id: string | number; username: string; name: string; role: number | string; department: string; active: boolean }) => {
  editingId.value = user.id;
  form.username = user.username;
  form.name = user.name;
  form.role = user.role;
  form.department = user.department;
  form.active = user.active;
  form.password = '';
  visible.value = true;
};

const save = async () => {
  if (!form.username.trim() || !form.name.trim()) {
    Message.warning('请填写用户名和姓名');
    return;
  }
  // 真实模式新建要求初始密码
  if (!editingId.value && useRealAdmin() && !form.password) {
    Message.warning('请填写初始密码');
    return;
  }
  saving.value = true;
  try {
    if (editingId.value) {
      await store.updateSystemUser({
        id: editingId.value,
        username: form.username.trim(),
        name: form.name.trim(),
        role: form.role,
        department: form.department.trim(),
        password: form.password || undefined,
      });
      Message.success('用户已更新');
    } else {
      await store.createSystemUser({
        username: form.username.trim(),
        name: form.name.trim(),
        role: form.role,
        department: form.department.trim(),
        password: form.password || undefined,
      });
      Message.success('用户已新增');
    }
    visible.value = false;
  } catch (error) {
    Message.error(error instanceof Error ? error.message : '保存失败');
  } finally {
    saving.value = false;
  }
};

const remove = async (record: { id: string | number }) => {
  try {
    await store.deleteSystemUser(record.id);
    Message.success('用户已删除');
  } catch (error) {
    Message.error(error instanceof Error ? error.message : '删除失败');
  }
};

onMounted(async () => {
  if (!useRealAdmin()) return;
  loading.value = true;
  try {
    await store.loadRemoteAdminUserGroups();
    await store.loadRemoteAdminUsers();
  } finally {
    loading.value = false;
  }
});
</script>
