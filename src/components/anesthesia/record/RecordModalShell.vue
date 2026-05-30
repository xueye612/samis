<template>
  <teleport to="body">
    <div class="record-modal-backdrop" :class="{ top: topLayer }" @click.self="$emit('close')" @keydown.esc="$emit('close')">
      <section class="record-modal" :class="[size]" tabindex="-1">
        <header>
          <strong>{{ title }}</strong>
          <button type="button" aria-label="关闭" @click="$emit('close')">×</button>
        </header>
        <div class="record-modal-body">
          <slot />
        </div>
        <footer v-if="$slots.footer">
          <slot name="footer" />
        </footer>
      </section>
    </div>
  </teleport>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title: string;
  size?: 'small' | 'medium' | 'large' | 'wide';
  topLayer?: boolean;
}>(), {
  size: 'medium',
  topLayer: false,
});

defineEmits<{ close: [] }>();
</script>

<style scoped>
.record-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: grid;
  place-items: start center;
  padding: 72px 16px 24px;
  overflow: auto;
  background: rgba(15, 23, 42, 0.32);
  backdrop-filter: blur(2px);
}

.record-modal-backdrop.top {
  z-index: 5200;
}

.record-modal {
  width: min(680px, 96vw);
  max-height: calc(100vh - 96px);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  border: 1px solid #dbeafe;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.22), 0 8px 20px rgba(15, 23, 42, 0.08);
  font-family: "Microsoft YaHei", sans-serif;
}

.record-modal.small {
  width: min(420px, 96vw);
}

.record-modal.large {
  width: min(820px, 96vw);
}

.record-modal.wide {
  width: min(1080px, 96vw);
}

.record-modal header,
.record-modal footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 18px;
  background: linear-gradient(180deg, #f8fbff 0%, #f1f5f9 100%);
  border-bottom: 1px solid #e2e8f0;
}

.record-modal footer {
  justify-content: flex-end;
  border-top: 1px solid #c8d7e8;
  border-bottom: 0;
}

.record-modal header strong {
  color: #12385f;
  font-size: 15px;
}

.record-modal header button {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #385979;
  font-size: 20px;
  line-height: 1;
}

.record-modal header button:hover {
  background: #d8e6f5;
}

.record-modal-body {
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px 18px 18px;
}
</style>
