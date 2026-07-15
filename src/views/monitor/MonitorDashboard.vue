<template>
  <ModulePageShell title="设备运行看板" description="注册设备和服务端告警的实时汇总，不使用本地演示设备">
    <template #toolbar><a-button :loading="loading" @click="load">刷新</a-button></template>
    <template #chips><a-tag color="green">在线 {{ count('online') }}</a-tag><a-tag color="red">告警 {{ count('alert') }}</a-tag><a-tag>离线 {{ count('offline') }}</a-tag></template>
    <template #stats><MetricCard label="设备总数" :value="devices.length" icon="IconDesktop" /><MetricCard label="在线" :value="count('online')" icon="IconCheckCircle" /><MetricCard label="告警设备" :value="count('alert')" icon="IconExclamationCircle" variant="warn" /><MetricCard label="未确认告警" :value="alerts.length" icon="IconExclamationCircle" :variant="alerts.length?'danger':'default'" /></template>
    <a-alert v-if="error" type="error" show-icon style="margin-bottom:12px">{{ error }}</a-alert>
    <a-card class="section-card" :bordered="false" title="设备状态矩阵">
      <div v-if="devices.length" class="device-grid"><div v-for="device in devices" :key="device.deviceId" class="device-card"><div class="device-head"><strong>{{ device.deviceId }}</strong><a-tag :color="color(device.status)">{{ label(device.status) }}</a-tag></div><div>{{ device.deviceType }} · {{ device.vendor || '厂商未登记' }}</div><div class="muted">最近心跳 {{ device.lastHeartbeatAt || '—' }}</div></div></div>
      <EmptyState v-else title="暂无设备数据" description="服务端设备注册目录为空" icon="IconDesktop" />
    </a-card>
    <a-card class="section-card" :bordered="false" title="未确认告警">
      <a-table v-if="alerts.length" :data="alerts" :pagination="false" row-key="alertId" size="small"><template #columns><a-table-column title="设备" data-index="deviceId" /><a-table-column title="级别" data-index="severity" /><a-table-column title="告警" data-index="message" /><a-table-column title="发生时间" data-index="occurredAt" /></template></a-table>
      <EmptyState v-else title="暂无未确认告警" icon="IconCheckCircle" />
    </a-card>
  </ModulePageShell>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';import MetricCard from '@/components/MetricCard.vue';import ModulePageShell from '@/components/shared/ModulePageShell.vue';import EmptyState from '@/components/shared/EmptyState.vue';import { anesthesiaDeviceV2Api, type DeviceAlertItem, type DeviceRegistryItem } from '@/api/anesthesiaDevice';
const devices=ref<DeviceRegistryItem[]>([]);const alerts=ref<DeviceAlertItem[]>([]);const loading=ref(false);const error=ref('');const count=(s:string)=>devices.value.filter(v=>v.status===s).length;const label=(v:string)=>({online:'在线',offline:'离线',alert:'告警'}[v]??v);const color=(v:string)=>({online:'green',offline:'gray',alert:'red'}[v]??'gray');
async function load(){loading.value=true;error.value='';try{const [d,a]=await Promise.all([anesthesiaDeviceV2Api.registryList({pageSize:100}),anesthesiaDeviceV2Api.alertList({status:'active',pageSize:100})]);devices.value=d.list??[];alerts.value=a.list??[];}catch(e){devices.value=[];alerts.value=[];error.value=e instanceof Error?e.message:'加载设备看板失败';}finally{loading.value=false;}}onMounted(load);
</script>
<style scoped>.device-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}.device-card{display:grid;gap:8px;padding:14px;border:1px solid var(--border);border-radius:var(--radius-md)}.device-head{display:flex;justify-content:space-between;gap:8px}.muted{color:var(--text-secondary);font-size:12px}</style>
