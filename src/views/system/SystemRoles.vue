<template>
  <ModulePageShell title="角色权限" description="系统角色与功能权限一览">
    <a-card class="section-card" :bordered="false" title="角色列表">
      <a-table :data="roles" row-key="id" :pagination="false">
        <template #columns>
          <a-table-column title="角色" data-index="name" :width="160" />
          <a-table-column title="说明" data-index="description" />
          <a-table-column title="权限">
            <template #cell="{ record }">
              <a-space wrap>
                <a-tag v-for="perm in record.permissions" :key="perm" color="arcoblue">{{ perm }}</a-tag>
              </a-space>
            </template>
          </a-table-column>
          <a-table-column title="用户数" data-index="userCount" :width="90" />
        </template>
      </a-table>
    </a-card>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';

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

const roles = computed(() =>
  ROLE_DEFS.map((role) => ({
    ...role,
    userCount: store.systemUsers.filter((u) => {
      const map: Record<string, string> = {
        admin: 'admin',
        anesthesiologist: 'anesthesiologist',
        nurse: 'nurse',
        viewer: 'viewer',
      };
      return u.role === map[role.id];
    }).length,
  })),
);
</script>
