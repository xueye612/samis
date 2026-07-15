import { defineStore } from 'pinia';
import {
  postAnalgesiaApi,
  type PostAnalgesiaDetailApi,
  type PostAnalgesiaPlanApi,
  type AnalgesiaStatus,
} from '@/api/anesthesiaWorkflow';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const TERMINAL_STATUSES: AnalgesiaStatus[] = ['stopped', 'completed', 'voided'];

export const usePostAnalgesiaStore = defineStore('post-analgesia-workflow', {
  state: () => ({
    detail: null as PostAnalgesiaDetailApi | null,
    loading: false,
    saving: false,
    error: null as string | null,
    loadedOperationId: null as string | null,
  }),
  getters: {
    currentPlan(): PostAnalgesiaPlanApi | null {
      return this.detail?.currentPlan ?? null;
    },
    isReadOnly(): boolean {
      const s = this.currentPlan?.status;
      return !!s && TERMINAL_STATUSES.includes(s);
    },
    canStart(): boolean {
      return this.currentPlan?.status === 'draft';
    },
    canPause(): boolean {
      return this.currentPlan?.status === 'active';
    },
    canResume(): boolean {
      return this.currentPlan?.status === 'paused';
    },
    canStop(): boolean {
      return this.currentPlan?.status === 'active' || this.currentPlan?.status === 'paused';
    },
    canComplete(): boolean {
      return this.currentPlan?.status === 'active';
    },
    canVoid(): boolean {
      const s = this.currentPlan?.status;
      return !!s && !TERMINAL_STATUSES.includes(s);
    },
    canAdjust(): boolean {
      return this.currentPlan?.status === 'active';
    },
    canAssess(): boolean {
      return this.currentPlan?.status === 'active';
    },
  },
  actions: {
    async load(operationId: string) {
      this.loading = true;
      this.error = null;
      try {
        this.detail = await postAnalgesiaApi.detail(operationId);
        this.loadedOperationId = operationId;
        return this.detail;
      } catch (error) {
        this.detail = null;
        this.loadedOperationId = null;
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async saveDraft(fields: Record<string, unknown>) {
      if (!this.loadedOperationId) throw new Error('请先选择手术病例');
      this.saving = true;
      this.error = null;
      try {
        const current = this.currentPlan;
        await postAnalgesiaApi.saveDraft({
          operationId: this.loadedOperationId,
          planVersionId: current?.planVersionId,
          expectedVersion: current?.version ?? 0,
          ...fields,
        });
        return await this.reloadCurrent();
      } catch (error) {
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.saving = false;
      }
    },

    async start() {
      const c = this.requireCurrent();
      this.saving = true;
      this.error = null;
      try {
        await postAnalgesiaApi.start({ planVersionId: c.planVersionId, expectedVersion: c.version });
        return await this.reloadCurrent();
      } catch (error) {
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.saving = false;
      }
    },

    async pause() {
      const c = this.requireCurrent();
      this.saving = true;
      this.error = null;
      try {
        await postAnalgesiaApi.pause({ planVersionId: c.planVersionId, expectedVersion: c.version });
        return await this.reloadCurrent();
      } catch (error) {
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.saving = false;
      }
    },

    async resume() {
      const c = this.requireCurrent();
      this.saving = true;
      this.error = null;
      try {
        await postAnalgesiaApi.resume({ planVersionId: c.planVersionId, expectedVersion: c.version });
        return await this.reloadCurrent();
      } catch (error) {
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.saving = false;
      }
    },

    async stop() {
      const c = this.requireCurrent();
      this.saving = true;
      this.error = null;
      try {
        await postAnalgesiaApi.stop({ planVersionId: c.planVersionId, expectedVersion: c.version });
        return await this.reloadCurrent();
      } catch (error) {
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.saving = false;
      }
    },

    async complete() {
      const c = this.requireCurrent();
      this.saving = true;
      this.error = null;
      try {
        await postAnalgesiaApi.complete({ planVersionId: c.planVersionId, expectedVersion: c.version });
        return await this.reloadCurrent();
      } catch (error) {
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.saving = false;
      }
    },

    async void_(reason: string) {
      const c = this.requireCurrent();
      this.saving = true;
      this.error = null;
      try {
        await postAnalgesiaApi.void({ planVersionId: c.planVersionId, expectedVersion: c.version, reason });
        return await this.reloadCurrent();
      } catch (error) {
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.saving = false;
      }
    },

    async adjust(nextParameters: Record<string, unknown>, reason: string) {
      const c = this.requireCurrent();
      this.saving = true;
      this.error = null;
      try {
        const result = await postAnalgesiaApi.adjust({ planVersionId: c.planVersionId, expectedVersion: c.version, nextParameters, reason });
        await this.reloadCurrent();
        return result;
      } catch (error) {
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.saving = false;
      }
    },

    async assess(scores: { vasScore?: number; sedationScore?: number; ponvScore?: number; pruritusScore?: number; respiratoryDepression?: boolean }) {
      const c = this.requireCurrent();
      this.saving = true;
      this.error = null;
      try {
        const result = await postAnalgesiaApi.assess({ planId: c.planId, ...scores });
        // Reload to get updated assessment list
        if (this.loadedOperationId) {
          await this.load(this.loadedOperationId);
        }
        return result;
      } catch (error) {
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.saving = false;
      }
    },

    replaceCurrent(plan: PostAnalgesiaPlanApi) {
      if (this.detail) {
        this.detail = { ...this.detail, currentPlan: plan };
      }
    },

    async reloadCurrent(): Promise<PostAnalgesiaPlanApi> {
      if (!this.loadedOperationId) throw new Error('请先选择手术病例');
      const detail = await postAnalgesiaApi.detail(this.loadedOperationId);
      this.detail = detail;
      if (!detail.currentPlan) throw new Error('保存后未回读到镇痛方案');
      return detail.currentPlan;
    },

    requireCurrent(): PostAnalgesiaPlanApi {
      if (!this.currentPlan) throw new Error('当前无镇痛方案');
      return this.currentPlan;
    },

    reset() {
      this.detail = null;
      this.loadedOperationId = null;
      this.error = null;
      this.loading = false;
      this.saving = false;
    },
  },
});
