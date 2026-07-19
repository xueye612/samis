<template>
  <ModulePageShell title="模拟数据配置" description="维护原型演示数据集与刷新策略">
    <template #chips>
      <a-tag color="arcoblue">病例 {{ store.cases.length }}</a-tag>
      <a-tag>PACU {{ store.pacuPatients.length }}</a-tag>
    </template>
    <a-card class="section-card" :bordered="false">
      <a-space direction="vertical" fill>
        <a-alert type="info" show-icon>当前为前端 Mock 原型，所有业务数据来自 qualitySeed 与 clinical 同步。</a-alert>
        <a-descriptions :column="2" bordered>
          <a-descriptions-item label="手术病例">{{ store.cases.length }}</a-descriptions-item>
          <a-descriptions-item label="PACU 患者">{{ store.pacuPatients.length }}</a-descriptions-item>
          <a-descriptions-item label="质控缺陷">{{ store.qualityDefects.length }}</a-descriptions-item>
          <a-descriptions-item label="数据集版本">{{ store.datasetVersion }}</a-descriptions-item>
        </a-descriptions>
        <a-space>
          <a-button type="primary" @click="refresh">刷新临床模块 Mock</a-button>
          <a-button @click="router.push('/quality/dashboard')">查看质控数据集</a-button>
        </a-space>
      </a-space>
    </a-card>

    <a-card class="section-card" :bordered="false" title="麻醉记录单实时设备数据源">
      <a-space direction="vertical" fill size="large">
        <a-alert :type="deviceSource === 'simulation' ? 'warning' : 'info'" show-icon>
          <template v-if="deviceSource === 'simulation'">
            当前读取系统内置模拟采集数据，仅用于设备协议尚未接入时的业务联调；界面会明确标记“模拟数据”。
          </template>
          <template v-else>
            当前读取真实设备网关数据。未完成设备绑定或网关未上送时，麻醉记录单会显示“未连接”。
          </template>
        </a-alert>
        <a-radio-group
          :model-value="deviceSource"
          type="button"
          :disabled="deviceSourceLoading"
          data-testid="device-realtime-source-selector"
          @change="changeDeviceSource"
        >
          <a-radio value="simulation">模拟采集数据</a-radio>
          <a-radio value="real">真实设备网关</a-radio>
        </a-radio-group>
        <a-descriptions :column="1" bordered>
          <a-descriptions-item label="模拟采集">点击记录单中的“启动监护仪/启动呼吸机”后立即生成首帧，并写入本地原始采集表。</a-descriptions-item>
          <a-descriptions-item label="真实设备">读取设备绑定、采集网关及服务端最新原始数据，不会回退或混入模拟数值。</a-descriptions-item>
        </a-descriptions>
        <a-space>
          <a-button
            type="primary"
            :disabled="deviceSourceLoading"
            :loading="deviceSourceSaving"
            @click="saveDeviceSource"
          >保存设备数据源</a-button>
          <span class="config-source-note">配置保存到后台临床配置表，并在下次进入麻醉记录单时生效。</span>
        </a-space>
      </a-space>
    </a-card>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { Message } from '@arco-design/web-vue';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import {
  loadDeviceRealtimeSource,
  saveDeviceRealtimeSource,
  type DeviceRealtimeSource,
} from '@/services/anesthesia/deviceRealtimeSource';

const router = useRouter();
const store = useAnesthesiaStore();
const deviceSource = ref<DeviceRealtimeSource>('simulation');
const deviceSourceLoading = ref(true);
const deviceSourceSaving = ref(false);
const changeDeviceSource = (value: string | number | boolean) => {
  if (value === 'simulation' || value === 'real') deviceSource.value = value;
};
const refresh = () => {
  store.refreshClinicalModules();
  Message.success('Mock 数据已刷新');
};
const saveDeviceSource = async () => {
  deviceSourceSaving.value = true;
  try {
    deviceSource.value = await saveDeviceRealtimeSource(deviceSource.value);
    Message.success('实时设备数据源已保存');
  } catch (error) {
    Message.error(error instanceof Error ? error.message : '设备数据源保存失败');
  } finally {
    deviceSourceSaving.value = false;
  }
};

onMounted(async () => {
  try {
    deviceSource.value = await loadDeviceRealtimeSource();
  } finally {
    deviceSourceLoading.value = false;
  }
});
</script>

<style scoped>
.config-source-note {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
