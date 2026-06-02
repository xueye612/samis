import { computed } from 'vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';

/** 统一判断本地 IndexedDB 是否已完成 hydration，供业务页与布局门控使用。 */
export function useAnesthesiaPersistenceGate() {
  const store = useAnesthesiaStore();
  const ready = computed(() => store.localPersistenceReady && !store.isHydrating);
  const hasRestoredLocalData = computed(() => store.hasRestoredLocalData);

  async function ensureReady() {
    await store.bootstrapAnesthesiaLocalPersistence();
    return ready.value;
  }

  return {
    ready,
    hasRestoredLocalData,
    ensureReady,
  };
}
