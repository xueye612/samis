import { defineStore } from 'pinia';
import {
  unplannedEventApi,
  type UnplannedEventApi,
  type UnplannedEventStatus,
} from '@/api/anesthesiaWorkflow';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const TERMINAL_STATUSES: UnplannedEventStatus[] = ['excluded', 'closed'];

export const useUnplannedEventStore = defineStore('unplanned-event-workflow', {
  state: () => ({
    detail: null as UnplannedEventApi | null,
    list: [] as UnplannedEventApi[],
    listTotal: 0,
    loading: false,
    saving: false,
    error: null as string | null,
    loadedEventId: null as string | null,
  }),
  getters: {
    isReadOnly(): boolean {
      const s = this.detail?.status;
      return !!s && TERMINAL_STATUSES.includes(s);
    },
    canReport(): boolean {
      return this.detail?.status === 'draft';
    },
    canStartReview(): boolean {
      return this.detail?.status === 'reported';
    },
    canConfirm(): boolean {
      return this.detail?.status === 'under_review';
    },
    canExclude(): boolean {
      return this.detail?.status === 'under_review';
    },
    canClose(): boolean {
      return this.detail?.status === 'confirmed';
    },
  },
  actions: {
    async loadDetail(eventId: string) {
      this.loading = true;
      this.error = null;
      try {
        this.detail = await unplannedEventApi.detail(eventId);
        this.loadedEventId = eventId;
        return this.detail;
      } catch (error) {
        this.detail = null;
        this.loadedEventId = null;
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async loadList(operationId: string) {
      this.loading = true;
      this.error = null;
      try {
        const result = await unplannedEventApi.list({ operationId });
        this.list = result.list;
        this.listTotal = result.total;
        return result;
      } catch (error) {
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async saveDraft(fields: Record<string, unknown>) {
      this.saving = true;
      this.error = null;
      try {
        const saved = await unplannedEventApi.saveDraft({
          eventId: this.detail?.eventId,
          expectedVersion: this.detail?.version ?? 0,
          ...fields,
        });
        this.detail = saved;
        return saved;
      } catch (error) {
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.saving = false;
      }
    },

    async report(fields: Record<string, unknown>) {
      this.saving = true;
      this.error = null;
      try {
        const saved = await unplannedEventApi.report({
          eventId: this.detail?.eventId,
          expectedVersion: this.detail?.version ?? 0,
          ...fields,
        });
        this.detail = saved;
        return saved;
      } catch (error) {
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.saving = false;
      }
    },

    async startReview() {
      const d = this.requireDetail();
      this.saving = true;
      this.error = null;
      try {
        this.detail = await unplannedEventApi.startReview({ eventId: d.eventId, expectedVersion: d.version });
        return this.detail;
      } catch (error) {
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.saving = false;
      }
    },

    async confirm(reviewOpinion?: string) {
      const d = this.requireDetail();
      this.saving = true;
      this.error = null;
      try {
        this.detail = await unplannedEventApi.confirm({ eventId: d.eventId, expectedVersion: d.version, reviewOpinion });
        return this.detail;
      } catch (error) {
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.saving = false;
      }
    },

    async exclude(reason: string) {
      const d = this.requireDetail();
      this.saving = true;
      this.error = null;
      try {
        this.detail = await unplannedEventApi.exclude({ eventId: d.eventId, expectedVersion: d.version, reason });
        return this.detail;
      } catch (error) {
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.saving = false;
      }
    },

    async close(reason: string) {
      const d = this.requireDetail();
      this.saving = true;
      this.error = null;
      try {
        this.detail = await unplannedEventApi.close({ eventId: d.eventId, expectedVersion: d.version, reason });
        return this.detail;
      } catch (error) {
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.saving = false;
      }
    },

    requireDetail(): UnplannedEventApi {
      if (!this.detail) throw new Error('当前无事件');
      return this.detail;
    },

    reset() {
      this.detail = null;
      this.loadedEventId = null;
      this.error = null;
      this.loading = false;
      this.saving = false;
    },
  },
});
