import { defineStore } from 'pinia';
import {
  anesthesiaHandoverApi,
  anesthesiaPlanApi,
  anesthesiaSummaryApi,
  type AnesthesiaHandoverApi,
  type AnesthesiaHandoverDetailApi,
  type AnesthesiaPlanApi,
  type AnesthesiaPlanDetailApi,
  type AnesthesiaSummaryApi,
} from '@/api/anesthesiaWorkflow';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const useAnesthesiaPlanStore = defineStore('anesthesia-plan-workflow', {
  state: () => ({
    detail: null as AnesthesiaPlanDetailApi | null,
    loading: false,
    saving: false,
    error: null as string | null,
    loadedOperationId: null as string | null,
  }),
  actions: {
    async load(operationId: string) {
      this.loading = true;
      this.error = null;
      try {
        this.detail = await anesthesiaPlanApi.detail(operationId);
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
        const current = this.detail?.currentPlan;
        const saved = await anesthesiaPlanApi.saveDraft({
          operationId: this.loadedOperationId,
          planVersionId: current?.planVersionId,
          expectedVersion: current?.version ?? 0,
          ...fields,
        });
        this.replaceCurrent(saved);
        return saved;
      } catch (error) {
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.saving = false;
      }
    },
    async submit() {
      const current = this.requireCurrent();
      this.saving = true;
      this.error = null;
      try {
        const saved = await anesthesiaPlanApi.submit({ planVersionId: current.planVersionId, expectedVersion: current.version });
        this.replaceCurrent(saved);
        return saved;
      } catch (error) {
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.saving = false;
      }
    },
    async cancel(reason: string) {
      const current = this.requireCurrent();
      this.saving = true; this.error = null;
      try { const saved = await anesthesiaPlanApi.cancel({ planVersionId: current.planVersionId, expectedVersion: current.version, reason }); this.replaceCurrent(saved); return saved; }
      catch (error) { this.error = errorMessage(error); throw error; } finally { this.saving = false; }
    },
    async createRevision(reason: string) {
      const current = this.requireCurrent();
      this.saving = true; this.error = null;
      try { const saved = await anesthesiaPlanApi.createRevision({ planVersionId: current.planVersionId, expectedVersion: current.version, reason }); this.replaceCurrent(saved); return saved; }
      catch (error) { this.error = errorMessage(error); throw error; } finally { this.saving = false; }
    },
    replaceCurrent(currentPlan: AnesthesiaPlanApi) {
      this.detail = this.detail
        ? { ...this.detail, currentPlan }
        : { operationId: currentPlan.operationId, operationCase: {}, currentPlan, historyMeta: { total: 1, versions: [] } };
    },
    requireCurrent(): AnesthesiaPlanApi {
      if (!this.detail?.currentPlan) throw new Error('请先保存麻醉计划草稿');
      return this.detail.currentPlan;
    },
  },
});

export const useAnesthesiaHandoverStore = defineStore('anesthesia-handover-workflow', {
  state: () => ({
    detail: null as AnesthesiaHandoverDetailApi | null,
    loading: false,
    saving: false,
    error: null as string | null,
    loadedOperationId: null as string | null,
  }),
  actions: {
    async load(operationId: string) {
      this.loading = true;
      this.error = null;
      try {
        this.detail = await anesthesiaHandoverApi.detail(operationId);
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
        const current = this.detail?.activeHandover;
        const saved = await anesthesiaHandoverApi.saveDraft({
          operationId: this.loadedOperationId,
          handoverVersionId: current?.handoverVersionId,
          expectedVersion: current?.version ?? 0,
          ...fields,
        });
        this.replaceCurrent(saved);
        return saved;
      } catch (error) {
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.saving = false;
      }
    },
    async submit() {
      const current = this.requireCurrent();
      if (current.checks.some((item) => item.result === 'exception' && !item.remark.trim())) {
        throw new Error('异常核查项必须填写备注');
      }
      return this.runAction(() => anesthesiaHandoverApi.submit({ handoverVersionId: current.handoverVersionId, expectedVersion: current.version }));
    },
    async accept() {
      const current = this.requireCurrent();
      return this.runAction(() => anesthesiaHandoverApi.accept({ handoverVersionId: current.handoverVersionId }));
    },
    async runAction(action: () => Promise<AnesthesiaHandoverApi>) {
      this.saving = true;
      this.error = null;
      try {
        const saved = await action();
        this.replaceCurrent(saved);
        return saved;
      } catch (error) {
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.saving = false;
      }
    },
    replaceCurrent(activeHandover: AnesthesiaHandoverApi) {
      this.detail = this.detail
        ? { ...this.detail, activeHandover }
        : { operationId: activeHandover.operationId, activeHandover, currentResponsibleDoctor: null, history: [] };
    },
    requireCurrent(): AnesthesiaHandoverApi {
      if (!this.detail?.activeHandover) throw new Error('请先保存交班草稿');
      return this.detail.activeHandover;
    },
  },
});

export const useAnesthesiaSummaryStore = defineStore('anesthesia-summary-workflow', {
  state: () => ({
    detail: null as AnesthesiaSummaryApi | null,
    loading: false,
    saving: false,
    error: null as string | null,
    loadedOperationId: null as string | null,
  }),
  actions: {
    async generate(operationId: string) {
      this.loading = true;
      this.error = null;
      try {
        this.detail = await anesthesiaSummaryApi.generate(operationId);
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
      const current = this.requireCurrent();
      return this.runAction(() => anesthesiaSummaryApi.saveDraft({
        summaryVersionId: current.summaryVersionId,
        expectedVersion: current.version,
        ...fields,
      }));
    },
    async submit() {
      const current = this.requireCurrent();
      return this.runAction(() => anesthesiaSummaryApi.submit({ summaryVersionId: current.summaryVersionId, expectedVersion: current.version }));
    },
    async runAction(action: () => Promise<AnesthesiaSummaryApi>) {
      this.saving = true;
      this.error = null;
      try {
        this.detail = await action();
        return this.detail;
      } catch (error) {
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.saving = false;
      }
    },
    requireCurrent(): AnesthesiaSummaryApi {
      if (!this.detail) throw new Error('请先生成麻醉小结');
      return this.detail;
    },
  },
});
