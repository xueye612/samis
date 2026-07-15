<template>
  <ModulePageShell title="设备数据采集" description="设备注册目录与真实心跳状态；厂商私有协议仍待外部资料">
    <template #toolbar>
      <a-select v-model="statusFilter" style="width:130px" allow-clear placeholder="状态"><a-option value="online">在线</a-option><a-option value="offline">离线</a-option><a-option value="alert">告警</a-option></a-select>
      <a-button :loading="loading" @click="load">刷新</a-button>
    </template>
    <a-alert v-if="error" type="error" show-icon style="margin-bottom:12px">{{ error }}</a-alert>
    <a-card class="section-card" :bordered="false" title="设备注册列表">
      <a-table v-if="rows.length || loading" :data="rows" :loading="loading" :pagination="false" row-key="deviceId">
        <template #columns>
          <a-table-column title="设备ID" data-index="deviceId" />
          <a-table-column title="设备类型" data-index="deviceType" />
          <a-table-column title="厂商/型号"><template #cell="{record}">{{ [record.vendor,record.model].filter(Boolean).join(' / ') || '未登记' }}</template></a-table-column>
          <a-table-column title="协议" data-index="protocolCode" />
          <a-table-column title="状态"><template #cell="{record}"><a-tag :color="color(record.status)">{{ label(record.status) }}</a-tag></template></a-table-column>
          <a-table-column title="最近心跳" data-index="lastHeartbeatAt" />
        </template>
      </a-table>
      <EmptyState v-else title="暂无设备注册数据" description="真实设备目录为空，页面不会补出演示设备" icon="IconDesktop" />
    </a-card>
  </ModulePageShell>
</template>
<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';import ModulePageShell from '@/components/shared/ModulePageShell.vue';import EmptyState from '@/components/shared/EmptyState.vue';import { anesthesiaDeviceV2Api, type DeviceRegistryItem } from '@/api/anesthesiaDevice';
const rows=ref<DeviceRegistryItem[]>([]);const loading=ref(false);const error=ref('');const statusFilter=ref('');const label=(v:string)=>({online:'在线',offline:'离线',alert:'告警'}[v]??v);const color=(v:string)=>({online:'green',offline:'gray',alert:'red'}[v]??'gray');
async function load(){loading.value=true;error.value='';try{rows.value=(await anesthesiaDeviceV2Api.registryList({status:statusFilter.value||undefined,pageSize:100})).list??[];}catch(e){rows.value=[];error.value=e instanceof Error?e.message:'加载设备失败';}finally{loading.value=false;}}
watch(statusFilter,load);onMounted(load);
</script>
