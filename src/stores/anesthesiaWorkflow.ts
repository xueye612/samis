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
  type AnesthesiaSummaryDetailApi,
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
        const operationId = this.loadedOperationId;
        const saved = await anesthesiaPlanApi.saveDraft({
          operationId,
          planVersionId: current?.planVersionId,
          expectedVersion: current?.version ?? 0,
          ...fields,
        });
        await this.load(operationId);
        return this.detail?.currentPlan ?? saved;
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
        await this.load(current.operationId);
        return this.detail?.currentPlan ?? saved;
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
      try { const saved = await anesthesiaPlanApi.cancel({ planVersionId: current.planVersionId, expectedVersion: current.version, reason }); await this.load(current.operationId); return this.detail?.currentPlan ?? saved; }
      catch (error) { this.error = errorMessage(error); throw error; } finally { this.saving = false; }
    },
    async createRevision(reason: string) {
      const current = this.requireCurrent();
      this.saving = true; this.error = null;
      try { const saved = await anesthesiaPlanApi.createRevision({ planVersionId: current.planVersionId, expectedVersion: current.version, reason }); await this.load(current.operationId); return this.detail?.currentPlan ?? saved; }
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
        await this.load(this.loadedOperationId);
        return this.detail?.activeHandover ?? saved;
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
      return this.runAction(() => anesthesiaHandoverApi.accept({ handoverVersionId: current.handoverVersionId, expectedVersion: current.version }));
    },
    async cancel(reason: string) {
      const current = this.requireCurrent();
      if (!reason.trim()) throw new Error('取消原因不能为空');
      return this.runAction(() => anesthesiaHandoverApi.cancelDraft({ handoverVersionId: current.handoverVersionId, expectedVersion: current.version, reason: reason.trim() }));
    },
    async runAction(action: () => Promise<AnesthesiaHandoverApi>) {
      this.saving = true;
      this.error = null;
      try {
        const saved = await action();
        await this.load(saved.operationId);
        return this.detail?.activeHandover ?? saved;
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
        : { operationId: activeHandover.operationId, operationCase: {}, activeHandover, currentResponsibleDoctor: null, history: [] };
    },
    requireCurrent(): AnesthesiaHandoverApi {
      if (!this.detail?.activeHandover) throw new Error('请先保存交班草稿');
      return this.detail.activeHandover;
    },
  },
});

export const useAnesthesiaSummaryStore = defineStore('anesthesia-summary-workflow', {
  state: () => ({
    detail: null as AnesthesiaSummaryDetailApi | null,
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
        this.detail = await anesthesiaSummaryApi.detail(operationId);
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
    async generate() {
      if (!this.loadedOperationId) throw new Error('请先选择手术病例');
      const current = this.detail?.currentSummary;
      return this.runAction(() => anesthesiaSummaryApi.generate({ operationId: this.loadedOperationId!, expectedVersion: current?.version ?? 0 }));
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
    async createRevision(reason: string) {
      const current = this.requireCurrent();
      if (!reason.trim()) throw new Error('修订原因不能为空');
      return this.runAction(() => anesthesiaSummaryApi.createRevision({ summaryVersionId: current.summaryVersionId, expectedVersion: current.version, reason: reason.trim() }));
    },
    async sign(signatureDocumentId: string) {
      const current = this.requireCurrent();
      return this.runAction(() => anesthesiaSummaryApi.sign({ summaryVersionId: current.summaryVersionId, expectedVersion: current.version, signatureDocumentId }));
    },
    async markPrinted() {
      const current = this.requireCurrent();
      return this.runAction(() => anesthesiaSummaryApi.markPrinted({ summaryVersionId: current.summaryVersionId, expectedVersion: current.version }));
    },
    async archive() {
      const current = this.requireCurrent();
      return this.runAction(() => anesthesiaSummaryApi.archive({ summaryVersionId: current.summaryVersionId, expectedVersion: current.version }));
    },
    async runAction(action: () => Promise<AnesthesiaSummaryApi>) {
      this.saving = true;
      this.error = null;
      try {
        const saved = await action();
        await this.load(saved.operationId);
        return this.detail?.currentSummary ?? saved;
      } catch (error) {
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.saving = false;
      }
    },
    requireCurrent(): AnesthesiaSummaryApi {
      if (!this.detail?.currentSummary) throw new Error('请先生成麻醉小结');
      return this.detail.currentSummary;
    },
  },
});
