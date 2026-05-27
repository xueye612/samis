<template>
  <div class="page-stack">
    <section class="module-hero">
      <div>
        <h2 class="module-hero__title">接口集成配置</h2>
        <p class="module-hero__desc">统一管理外部系统接口连通性与最近同步状态。</p>
      </div>
      <div class="module-hero__chips">
        <a-tag color="arcoblue">接口 {{ store.integrationEndpoints.length }}</a-tag>
      </div>
    </section>
    <a-card class="section-card" :bordered="false" title="接口配置">
      <a-table :data="store.integrationEndpoints" :pagination="false" row-key="id">
        <template #columns>
          <a-table-column title="系统" data-index="name" />
          <a-table-column title="地址" data-index="endpoint" />
          <a-table-column title="状态" data-index="status" />
          <a-table-column title="最近同步" data-index="lastSync" />
          <a-table-column title="操作" :width="120">
            <template #cell="{ record }">
              <a-button size="mini" type="primary" @click="store.triggerIntegrationSync(record.id)">模拟同步</a-button>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { useAnesthesiaStore } from '@/stores/anesthesia';

const store = useAnesthesiaStore();
</script>
