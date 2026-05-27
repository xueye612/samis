<template>
  <div class="page-stack">
    <a-card class="section-card" :bordered="false">
      <template #title>
        <span class="section-icon"><icon-desktop /></span>
        系统管理
      </template>
      <div class="config-grid">
        <a-card :bordered="true">
          <template #title>
            <AppIcon name="IconUser" :size="16" />
            <span>角色权限</span>
          </template>
          <a-list size="small">
            <a-list-item>麻醉医师：可维护本人记录单和术后随访</a-list-item>
            <a-list-item>麻醉护士：可录入用药、输液输血、PACU记录</a-list-item>
            <a-list-item>质控管理员：可审核缺陷并解锁记录单</a-list-item>
          </a-list>
        </a-card>
        <a-card :bordered="true">
          <template #title>
            <AppIcon name="IconFile" :size="16" />
            <span>记录单锁定策略</span>
          </template>
          <a-descriptions :column="1" size="small">
            <a-descriptions-item label="自动锁定">离室后24小时</a-descriptions-item>
            <a-descriptions-item label="补记提醒">抢救记录、特殊事件、PACU延迟</a-descriptions-item>
            <a-descriptions-item label="权限提示">已锁定记录修改需质控管理员授权</a-descriptions-item>
          </a-descriptions>
        </a-card>
        <a-card :bordered="true">
          <template #title>
            <AppIcon name="IconStorage" :size="16" />
            <span>审计模拟</span>
          </template>
          <a-timeline>
            <a-timeline-item label="08:25">王睿创建 OR-01 麻醉记录单</a-timeline-item>
            <a-timeline-item label="10:35">梁琛上报低体温事件</a-timeline-item>
            <a-timeline-item label="12:40">许清发起非计划转ICU审核</a-timeline-item>
          </a-timeline>
        </a-card>
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
</script>

<style scoped>
.section-card :deep(.arco-card-header-title) {
  display: inline-flex;
  align-items: center;
}

.config-grid :deep(.arco-card-header-title) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>
