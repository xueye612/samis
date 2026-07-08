<template>
  <ModulePageShell title="角色权限" description="系统角色与功能权限一览">
    <a-card class="section-card" :bordered="false" title="角色列表">
      <template #extra>
        <a-tag v-if="sourceLabel" :color="sourceLabel === '远程' ? 'arcoblue' : 'gray'" size="small">数据源：{{ sourceLabel }}</a-tag>
      </template>
      <a-table :data="roles" row-key="id" :pagination="false">
        <template #columns>
          <a-table-column title="角色" data-index="name" :width="160" />
          <a-table-column title="说明" data-index="description" />
          <a-table-column title="权限">
            <template #cell="{ record }">
              <a-space wrap>
                <a-tag v-for="perm in record.permissions" :key="perm" color="arcoblue">{{ perm }}</a-tag>
                <span v-if="!record.permissions || !record.permissions.length">—</span>
              </a-space>
            </template>
          </a-table-column>
          <a-table-column title="用户数" data-index="userCount" :width="90" />
        </template>
      </a-table>
    </a-card>

    <a-card
      v-if="useRealAdmin() && store.remoteMenuTreeSource === 'remote'"
      class="section-card"
      :bordered="false"
      title="当前登录用户菜单权限"
      style="margin-top: 16px"
    >
      <a-empty v-if="!menuTreeData.length" description="暂无菜单权限" />
      <a-tree
        v-else
        :data="menuTreeData"
        :default-expand-all="true"
        :selectable="false"
      />
    </a-card>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import { useRealAdmin } from '@/config/apiFlags';

const ROLE_DEFS = [
  {
    id: 'admin',
    name: '质控管理员',
    description: '全院质控、配置与审计',
    permissions: ['质控看板', '缺陷整改', '用户管理', '审计日志', '系统配置', '报表导出'],
  },
  {
    id: 'anesthesiologist',
    name: '麻醉医师',
    description: '临床记录与术中操作',
    permissions: ['手术排班', '麻醉记录单', '术前访视', 'PACU管理', '术后随访', '特殊事件'],
  },
  {
    id: 'nurse',
    name: '麻醉护士',
    description: '护理协同与PACU接收',
    permissions: ['PACU接收', '转出登记', '用药核对', '安全核查'],
  },
  {
    id: 'viewer',
    name: '只读用户',
    description: '查询与报表浏览',
    permissions: ['工作台浏览', '统计报表', '质控只读'],
  },
];

const store = useAnesthesiaStore();

const roles = computed(() => {
  const users = store.systemUsers;
  if (
    useRealAdmin()
    && store.remoteAdminUserGroupsSource === 'remote'
    && store.remoteAdminUserGroups.length
  ) {
    return store.remoteAdminUserGroups.map((g) => {
      const perms = Array.isArray(g.catidsList) ? g.catidsList : [];
      return {
        id: g.groupid,
        name: g.name,
        description: perms.length ? perms.join('、') : '—',
        permissions: perms,
        userCount: users.filter((u) => Number(u.role) === Number(g.groupid)).length,
      };
    });
  }
  return ROLE_DEFS.map((role) => ({
    ...role,
    userCount: users.filter((u) => u.role === role.id).length,
  }));
});

const menuTreeData = computed(() => {
  const map = (nodes: typeof store.remoteMenuTree): Array<{ key: string | number; title: string; children?: Array<{ key: string | number; title: string }> }> =>
    nodes.map((n) => ({
      key: n.id,
      title: String(n.name ?? ''),
      children: Array.isArray(n.childsList) && n.childsList.length
        ? n.childsList.map((c) => ({ key: `${n.id}-${c.id}`, title: String(c.name ?? '') }))
        : undefined,
    }));
  return map(store.remoteMenuTree);
});

const sourceLabel = computed(() =>
  useRealAdmin() && store.remoteAdminUserGroupsSource === 'remote' ? '远程' : '本地',
);

onMounted(async () => {
  if (!useRealAdmin()) return;
  await Promise.all([store.loadRemoteAdminUserGroups(), store.loadRemoteMenuTree()]);
});
</script>
