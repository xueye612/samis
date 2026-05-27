<template>
  <a-timeline>
    <a-timeline-item v-for="event in events" :key="event.id" :label="event.time">
      {{ event.type }} · {{ event.stage }} · {{ event.treatment || '待补记' }}
    </a-timeline-item>
  </a-timeline>
</template>

<script setup lang="ts">
import type { AnesthesiaEvent } from '@/types/anesthesia';

defineProps<{ events: AnesthesiaEvent[] }>();
</script>
