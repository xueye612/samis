import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = {
  getStaffConfig: vi.fn(),
  getStaffDetail: vi.fn(),
  saveStaff: vi.fn(),
  getProfessionalItems: vi.fn(),
  getProfessionalItemDetail: vi.fn(),
  saveProfessionalItem: vi.fn(),
  changeProfessionalStatus: vi.fn(),
  professionalHistory: vi.fn(),
  getMethodCategories: vi.fn(),
  saveMethodCategory: vi.fn(),
};

vi.mock('@/api/anesthesiaDict', () => ({ anesthesiaDictApi: apiMock }));
vi.mock('@/api/samisHttpClient', () => ({
  SamisHttpError: class SamisHttpError extends Error {
    constructor(message: string, public status: number, public code?: number) {
      super(message);
    }
  },
}));

const {
  loadStaffConfig,
  saveStaffConfig,
  loadProfessionalItems,
  saveProfessionalItem,
  changeStaffStatusConfig,
  loadStaffHistory,
  loadProfessionalHistory,
  loadMethodCategories,
  saveMethodCategoryConfig,
  changeCategoryStatusConfig,
  canManageStaff,
  canManageProfessional,
  ProfessionalConflictError,
} = await import('@/services/configuration/professionalDictionaryService');

describe('professionalDictionaryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('empty staff list stays empty, no seed', async () => {
    apiMock.getStaffConfig.mockResolvedValue({ list: [] });
    const list = await loadStaffConfig();
    expect(list).toEqual([]);
  });

  it('maps staff profile preserving scopes/version/status (no fabrication)', async () => {
    apiMock.getStaffConfig.mockResolvedValue({
      list: [{
        id: 12, gh: 'STAFF-1', name: '甲', professionalGroup: '心血管', status: 'paused', version: 3,
        scopes: [{ scopeType: 'practice', scopeCode: 'CARD', scopeName: '心血管' }],
      }],
    });
    const list = await loadStaffConfig();
    expect(list[0].gh).toBe('STAFF-1');
    expect(list[0].status).toBe('paused');
    expect(list[0].version).toBe(3);
    expect(list[0].scopes).toHaveLength(1);
  });

  it('saveStaff returns version; conflict maps to ProfessionalConflictError', async () => {
    apiMock.saveStaff.mockResolvedValue({ id: 30, version: 1 });
    const r = await saveStaffConfig({ gh: 'STAFF-1', name: '甲' });
    expect(r.id).toBe(30);
    expect(r.version).toBe(1);

    const { SamisHttpError } = await import('@/api/samisHttpClient');
    apiMock.saveStaff.mockRejectedValueOnce(new SamisHttpError('conflict', 200, 4091));
    await expect(saveStaffConfig({ gh: 'STAFF-1' })).rejects.toBeInstanceOf(ProfessionalConflictError);
  });

  it('loadProfessionalItems maps method profile', async () => {
    apiMock.getProfessionalItems.mockResolvedValue({
      list: [{ id: 5, categoryCode: 'anesthesia_method', itemCode: 'GA', itemName: '全麻', version: 2, status: 'enabled', profile: { airwayStrategy: '气管插管', version: 2 } }],
    });
    const items = await loadProfessionalItems('anesthesia_method');
    expect(items[0].itemCode).toBe('GA');
    expect(items[0].version).toBe(2);
    const profile = items[0].profile as { airwayStrategy: string };
    expect(profile.airwayStrategy).toBe('气管插管');
  });

  it('score ruleDefinition parsed as structured array', async () => {
    apiMock.getProfessionalItems.mockResolvedValue({
      list: [{ id: 7, categoryCode: 'anesthesia_score', itemCode: 'APGAR', itemName: 'Apgar', version: 1, profile: { ruleDefinition: '[{"dimension":"心率"}]', version: 1 } }],
    });
    const items = await loadProfessionalItems('anesthesia_score');
    const profile = items[0].profile as { ruleDefinition: Array<{ dimension: string }> };
    expect(Array.isArray(profile.ruleDefinition)).toBe(true);
    expect(profile.ruleDefinition[0].dimension).toBe('心率');
  });

  it('changeStaffStatus delegates entityType=staff', async () => {
    apiMock.changeProfessionalStatus.mockResolvedValue({ status: 'paused', version: 2 });
    const r = await changeStaffStatusConfig({ id: 30, toStatus: 'paused', reason: '休假', expectedVersion: 1 });
    expect(r.status).toBe('paused');
    expect(apiMock.changeProfessionalStatus).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'staff', toStatus: 'paused' }));
  });

  it('history mapping preserves order', async () => {
    apiMock.professionalHistory.mockResolvedValue({
      list: [
        { id: 1, toStatus: 'enabled', version: 1, occurredAt: '2026-07-14 08:00:00' },
        { id: 2, toStatus: 'disabled', version: 2, occurredAt: '2026-07-14 09:00:00' },
      ],
    });
    const h1 = await loadStaffHistory(30);
    const h2 = await loadProfessionalHistory('score', 7);
    expect(h1[1].toStatus).toBe('disabled');
    expect(h2).toHaveLength(2);
  });

  it('permission helpers honor wildcard and explicit codes', () => {
    expect(canManageStaff(['*'])).toBe(true);
    expect(canManageStaff(['config.staff.manage'])).toBe(true);
    expect(canManageStaff(['other'])).toBe(false);
    expect(canManageProfessional(['config.method.manage'], 'anesthesia_method')).toBe(true);
    expect(canManageProfessional(['config.event.manage'], 'anesthesia_event')).toBe(true);
    expect(canManageProfessional(['config.score.manage'], 'anesthesia_score')).toBe(true);
    expect(canManageProfessional(['config.method.manage'], 'anesthesia_score')).toBe(false);
  });

  it('loadMethodCategories maps category preserving id/version/status', async () => {
    apiMock.getMethodCategories.mockResolvedValue({
      list: [{ id: 9, categoryCode: 'GA', categoryName: '全身麻醉', domainCode: 'anesthesia_method', status: 'paused', version: 2, sortNo: 1 }],
    });
    const cats = await loadMethodCategories({ allStatus: true });
    expect(cats[0].categoryCode).toBe('GA');
    expect(cats[0].status).toBe('paused');
    expect(cats[0].version).toBe(2);
  });

  it('saveMethodCategoryConfig returns version', async () => {
    apiMock.saveMethodCategory.mockResolvedValue({ id: 20, version: 1 });
    const r = await saveMethodCategoryConfig({ categoryCode: 'NEW', categoryName: '新大类' });
    expect(r.id).toBe(20);
    expect(r.version).toBe(1);
  });

  it('changeCategoryStatusConfig delegates entityType=method_category', async () => {
    apiMock.changeProfessionalStatus.mockResolvedValue({ status: 'paused', version: 2 });
    const r = await changeCategoryStatusConfig({ id: 20, toStatus: 'paused', reason: '检修', expectedVersion: 1 });
    expect(r.status).toBe('paused');
    expect(apiMock.changeProfessionalStatus).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'method_category', toStatus: 'paused' }));
  });
});
