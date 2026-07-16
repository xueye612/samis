<template>
  <div class="realtime-waveform-placeholder no-print" data-testid="realtime-waveform-placeholder" role="status" aria-live="off">
    <span class="waveform-icon" aria-hidden="true">〜</span>
    <span class="waveform-text">暂无实时波形</span>
  </div>
</template>

<script setup lang="ts">
// 仅占位：不绘制任何模拟曲线，不建立虚假波形数据，不依赖实时设备 service/API/store。
// 真实波形数据接入属于后续独立批次，届时替换本占位。
</script>

<style scoped>
.realtime-waveform-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  max-height: 56px;
  min-height: 32px;
  padding: 6px 10px;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  background: repeating-linear-gradient(90deg, #f8fafc 0 6px, #eef2f7 6px 12px);
  color: #64748b;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
}

.waveform-icon {
  font-size: 14px;
  letter-spacing: -2px;
  color: #94a3b8;
}

.waveform-text {
  font-weight: 600;
}
</style>
