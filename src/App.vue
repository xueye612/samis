<template>
  <router-view v-if="$route.meta.fullscreen" />
  <AppLayout v-else />
</template>

<script setup lang="ts">
import AppLayout from '@/layout/AppLayout.vue';
</script>
