import { defineStore } from 'pinia';
import { pacuApi } from '@/api/pacu';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface PacuScoreApi {
  scoreId: string;
  operationId: string;
  pacuRecordId: string;
  scoredAt: string;
  activity: number;
  respiration: number;
  circulation: number;
  consciousness: number;
  spo2: number;
  total: number;
  painScore: number | null;
  sedationScore: number | null;
  ponvScore: number | null;
  shiveringScore: number | null;
  scorerId: string | null;
}

export interface PacuOrderApi {
  orderId: string;
  operationId: string;
  pacuRecordId: string;
  orderType: string;
  content: Record<string, unknown> | null;
  status: string;
  orderedBy: string;
  orderedAt: string;
  stoppedBy: string | null;
  stoppedAt: string | null;
}

export interface PacuExecutionApi {
  executionId: string;
  executedBy: string;
  executedAt: string;
  result: string | null;
  exceptionNote: string | null;
}

export const usePacuExtensionStore = defineStore('pacu-extension', {
  state: () => ({
    scores: [] as PacuScoreApi[],
    orders: [] as PacuOrderApi[],
    executions: {} as Record<string, PacuExecutionApi[]>,
    loading: false,
    saving: false,
    error: null as string | null,
    loadedOperationId: null as string | null,
  }),
  getters: {
    latestScore(): PacuScoreApi | null {
      return this.scores.length > 0 ? this.scores[0] : null;
    },
    activeOrders(): PacuOrderApi[] {
      return this.orders.filter((o) => o.status === 'active');
    },
  },
  actions: {
    async load(operationId: string) {
      if (!operationId) return;
      this.loading = true;
      this.error = null;
      try {
        const [scoreResult, orderResult] = await Promise.all([
          pacuApi.scoreList(operationId),
          pacuApi.orderList(operationId),
        ]);
        this.scores = (scoreResult as { list: PacuScoreApi[] }).list ?? [];
        this.orders = (orderResult as { list: PacuOrderApi[] }).list ?? [];
        this.loadedOperationId = operationId;
      } catch (error) {
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async createScore(data: {
      operationId: string;
      pacuRecordId: string;
      activity: number;
      respiration: number;
      circulation: number;
      consciousness: number;
      spo2: number;
      painScore?: number;
      sedationScore?: number;
      ponvScore?: number;
      shiveringScore?: number;
    }) {
      this.saving = true;
      this.error = null;
      try {
        const created = await pacuApi.scoreCreate(data) as unknown as PacuScoreApi;
        await this.load(data.operationId);
        return created;
      } catch (error) {
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.saving = false;
      }
    },

    async createOrder(data: {
      operationId: string;
      pacuRecordId: string;
      orderType: string;
      content: Record<string, unknown>;
    }) {
      this.saving = true;
      this.error = null;
      try {
        const created = await pacuApi.orderCreate(data) as unknown as PacuOrderApi;
        await this.load(data.operationId);
        return created;
      } catch (error) {
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.saving = false;
      }
    },

    async executeOrder(orderId: string, result?: string, exceptionNote?: string) {
      this.saving = true;
      this.error = null;
      try {
        const res = await pacuApi.orderExecute({ orderId, result, exceptionNote }) as unknown as { executionId: string };
        // Load executions for this order
        try {
          const execResult = await pacuApi.orderExecutions(orderId) as unknown as { list: PacuExecutionApi[] };
          this.executions[orderId] = execResult.list ?? [];
        } catch { /* ignore */ }
        if (this.loadedOperationId) await this.load(this.loadedOperationId);
        return res;
      } catch (error) {
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.saving = false;
      }
    },

    async stopOrder(orderId: string, reason?: string) {
      this.saving = true;
      this.error = null;
      try {
        await pacuApi.orderStop(orderId, reason ?? '');
        if (this.loadedOperationId) await this.load(this.loadedOperationId);
      } catch (error) {
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.saving = false;
      }
    },

    async forceDischarge(operationId: string, reason: string, reasonCode: string, approverId?: string) {
      this.saving = true;
      this.error = null;
      try {
        return await pacuApi.forceDischarge(operationId, reason, reasonCode, approverId);
      } catch (error) {
        this.error = errorMessage(error);
        throw error;
      } finally {
        this.saving = false;
      }
    },

    async loadExecutions(orderId: string) {
      try {
        const res = await pacuApi.orderExecutions(orderId) as unknown as { list: PacuExecutionApi[] };
        this.executions[orderId] = res.list ?? [];
      } catch { /* ignore */ }
    },

    reset() {
      this.scores = [];
      this.orders = [];
      this.executions = {};
      this.loadedOperationId = null;
      this.error = null;
      this.loading = false;
      this.saving = false;
    },
  },
});
