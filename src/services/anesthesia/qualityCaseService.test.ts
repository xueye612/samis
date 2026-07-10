import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/api/quality', () => ({ qualityApi: { caseList:vi.fn(), caseDetail:vi.fn(), defectCreate:vi.fn(async x=>x), defectUpdate:vi.fn(), defectClose:vi.fn() } }));
describe('quality case adapter',()=>{
 beforeEach(()=>vi.resetModules());
 it('keeps mock fallback without HTTP',async()=>{vi.stubEnv('VITE_ANESTHESIA_USE_MOCK','true');vi.stubEnv('VITE_USE_REAL_QUALITY','false');const m=await import('./qualityCaseService');expect(await m.loadQualityCases()).toEqual({list:[],total:0});});
 it('uses real case path when opted in',async()=>{vi.stubEnv('VITE_ANESTHESIA_USE_MOCK','true');vi.stubEnv('VITE_USE_REAL_QUALITY','true');const api=await import('@/api/quality');vi.mocked(api.qualityApi.caseList).mockResolvedValue({list:[],total:2});const m=await import('./qualityCaseService');expect((await m.loadQualityCases()).total).toBe(2);});
 it('never writes patient or operation master data',async()=>{const m=await import('./qualityCaseService');expect(m.defectWritePayload({operationId:'OP-1',indicatorCode:'x',patientName:'P',patientId:'1',operationName:'S',operationCase:{}})).toEqual({operationId:'OP-1',indicatorCode:'x'});});
});
