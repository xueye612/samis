import { anesthesiaPlanApi, type AnesthesiaPlanApi } from '@/api/anesthesiaWorkflow';
import { anesthesiaHandoverApi, type AnesthesiaHandoverApi } from '@/api/anesthesiaWorkflow';
import { anesthesiaSummaryApi, type AnesthesiaSummaryApi } from '@/api/anesthesiaWorkflow';

/**
 * 麻醉工作流域服务层。
 *
 * 连接 Vue 页面和后端 API，处理 loading/error 状态。
 * 页面可逐步从 mock store 切换到此服务。
 */

export class AnesthesiaPlanService {
  private current: AnesthesiaPlanApi | null = null;
  private loading = false;
  private error: string | null = null;

  async load(operationId: string): Promise<AnesthesiaPlanApi | null> {
    this.loading = true;
    this.error = null;
    try {
      const result = await anesthesiaPlanApi.detail(operationId);
      this.current = result.currentPlan;
      return this.current;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      return null;
    } finally {
      this.loading = false;
    }
  }

  async saveDraft(operationId: string, data: Record<string, unknown>): Promise<AnesthesiaPlanApi | null> {
    this.loading = true;
    try {
      const plan = await anesthesiaPlanApi.saveDraft({ operationId, ...data });
      this.current = plan;
      return plan;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      return null;
    } finally {
      this.loading = false;
    }
  }

  async submit(planVersionId: string, expectedVersion: number): Promise<AnesthesiaPlanApi | null> {
    this.loading = true;
    try {
      const plan = await anesthesiaPlanApi.submit({ planVersionId, expectedVersion });
      this.current = plan;
      return plan;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      return null;
    } finally {
      this.loading = false;
    }
  }

  getCurrent(): AnesthesiaPlanApi | null { return this.current; }
  isLoading(): boolean { return this.loading; }
  getError(): string | null { return this.error; }
}

export class AnesthesiaHandoverService {
  private current: AnesthesiaHandoverApi | null = null;
  private loading = false;
  private error: string | null = null;

  async load(operationId: string): Promise<AnesthesiaHandoverApi | null> {
    this.loading = true;
    this.error = null;
    try {
      const result = await anesthesiaHandoverApi.detail(operationId);
      this.current = result.activeHandover;
      return this.current;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      return null;
    } finally {
      this.loading = false;
    }
  }

  async saveDraft(operationId: string, data: Record<string, unknown>): Promise<AnesthesiaHandoverApi | null> {
    this.loading = true;
    try {
      const handover = await anesthesiaHandoverApi.saveDraft({ operationId, ...data });
      this.current = handover;
      return handover;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      return null;
    } finally {
      this.loading = false;
    }
  }

  async submit(handoverVersionId: string): Promise<AnesthesiaHandoverApi | null> {
    this.loading = true;
    try {
      const handover = await anesthesiaHandoverApi.submit({ handoverVersionId });
      this.current = handover;
      return handover;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      return null;
    } finally {
      this.loading = false;
    }
  }

  async accept(handoverVersionId: string): Promise<AnesthesiaHandoverApi | null> {
    this.loading = true;
    try {
      const handover = await anesthesiaHandoverApi.accept({ handoverVersionId });
      this.current = handover;
      return handover;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      return null;
    } finally {
      this.loading = false;
    }
  }

  getCurrent(): AnesthesiaHandoverApi | null { return this.current; }
  isLoading(): boolean { return this.loading; }
  getError(): string | null { return this.error; }
}

export class AnesthesiaSummaryService {
  private current: AnesthesiaSummaryApi | null = null;
  private loading = false;
  private error: string | null = null;

  async generate(operationId: string): Promise<AnesthesiaSummaryApi | null> {
    this.loading = true;
    this.error = null;
    try {
      this.current = await anesthesiaSummaryApi.generate(operationId);
      return this.current;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      return null;
    } finally {
      this.loading = false;
    }
  }

  async saveDraft(summaryVersionId: string, data: Record<string, unknown>): Promise<AnesthesiaSummaryApi | null> {
    this.loading = true;
    try {
      this.current = await anesthesiaSummaryApi.saveDraft({ summaryVersionId, ...data });
      return this.current;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      return null;
    } finally {
      this.loading = false;
    }
  }

  async submit(summaryVersionId: string): Promise<AnesthesiaSummaryApi | null> {
    this.loading = true;
    try {
      this.current = await anesthesiaSummaryApi.submit({ summaryVersionId });
      return this.current;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      return null;
    } finally {
      this.loading = false;
    }
  }

  getCurrent(): AnesthesiaSummaryApi | null { return this.current; }
  isLoading(): boolean { return this.loading; }
  getError(): string | null { return this.error; }
}

export const planService = new AnesthesiaPlanService();
export const handoverService = new AnesthesiaHandoverService();
export const summaryService = new AnesthesiaSummaryService();
