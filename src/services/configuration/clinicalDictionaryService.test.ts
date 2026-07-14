import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = {
  getClinicalDictionary: vi.fn(),
  getClinicalDictionaryDetail: vi.fn(),
  saveClinicalDictionary: vi.fn(),
  changeClinicalDictionaryStatus: vi.fn(),
  clinicalDictionaryHistory: vi.fn(),
};

vi.mock('@/api/anesthesiaDict', () => ({ anesthesiaDictApi: apiMock }));
vi.mock('@/api/samisHttpClient', () => ({
  SamisHttpError: class SamisHttpError extends Error {
    constructor(message: string, public status: number, public code?: number) { super(message); }
  },
}));

const {
  loadClinicalDictionary, saveClinicalDictionary, changeClinicalDictionaryStatus,
  loadClinicalDictionaryHistory, canManageClinical, ClinicalConflictError,
  DRUG_PERM, FLUID_PERM, VITAL_PERM, TEMPLATE_PERM,
} = await import('@/services/configuration/clinicalDictionaryService');

describe('clinicalDictionaryService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('empty list stays empty', async () => {
    apiMock.getClinicalDictionary.mockResolvedValue({ list: [] });
    expect(await loadClinicalDictionary('drug')).toEqual([]);
  });

  it('save returns version; conflict maps to ClinicalConflictError', async () => {
    apiMock.saveClinicalDictionary.mockResolvedValue({ id: 10, version: 1 });
    const r = await saveClinicalDictionary({ entityType: 'drug', drugCode: 'D1' });
    expect(r.id).toBe(10);
    expect(r.version).toBe(1);
    const { SamisHttpError } = await import('@/api/samisHttpClient');
    apiMock.saveClinicalDictionary.mockRejectedValueOnce(new SamisHttpError('conflict', 200, 4091));
    await expect(saveClinicalDictionary({ entityType: 'drug' })).rejects.toBeInstanceOf(ClinicalConflictError);
  });

  it('changeClinicalDictionaryStatus returns status and version', async () => {
    apiMock.changeClinicalDictionaryStatus.mockResolvedValue({ status: 'paused', version: 2 });
    const r = await changeClinicalDictionaryStatus({ entityType: 'drug', id: 10, toStatus: 'paused', expectedVersion: 1 });
    expect(r.status).toBe('paused');
    expect(r.version).toBe(2);
  });

  it('history mapping preserves order', async () => {
    apiMock.clinicalDictionaryHistory.mockResolvedValue({ list: [
      { id: 1, toStatus: 'enabled', version: 1, occurredAt: '2026-07-14 08:00:00' },
      { id: 2, toStatus: 'disabled', version: 2, occurredAt: '2026-07-14 09:00:00' },
    ] });
    const h = await loadClinicalDictionaryHistory('drug', 10);
    expect(h).toHaveLength(2);
    expect(h[1].toStatus).toBe('disabled');
  });

  it('permission helpers honor wildcard and explicit codes', () => {
    expect(canManageClinical(['*'], 'drug')).toBe(true);
    expect(canManageClinical([DRUG_PERM], 'drug')).toBe(true);
    expect(canManageClinical([FLUID_PERM], 'fluid')).toBe(true);
    expect(canManageClinical([FLUID_PERM], 'blood')).toBe(true); // blood shares fluid perm
    expect(canManageClinical([VITAL_PERM], 'vital')).toBe(true);
    expect(canManageClinical([TEMPLATE_PERM], 'template')).toBe(true);
    expect(canManageClinical([DRUG_PERM], 'vital')).toBe(false);
    expect(canManageClinical(null, 'drug')).toBe(false);
  });
});
