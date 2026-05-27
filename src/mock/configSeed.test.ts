import {
  enabledVitalSigns,
  flattenMethodOptions,
  seedDrugDict,
  seedFluidBloodDict,
  seedMethodCategories,
  seedVitalSignDict,
} from '@/mock/configSeed';

describe('config seed data', () => {
  it('defines anesthesia method categories with children', () => {
    expect(seedMethodCategories.length).toBeGreaterThanOrEqual(5);
    seedMethodCategories.forEach((category) => {
      expect(category.name).toBeTruthy();
      expect(category.children.length).toBeGreaterThan(0);
      category.children.forEach((child) => {
        expect(child.code).toBeTruthy();
        expect(child.name).toBeTruthy();
      });
    });
    const flat = flattenMethodOptions(seedMethodCategories);
    expect(flat.length).toBeGreaterThan(seedMethodCategories.length);
  });

  it('defines drugs with dose unit and specification', () => {
    expect(seedDrugDict.length).toBeGreaterThanOrEqual(10);
    seedDrugDict.forEach((drug) => {
      expect(drug.doseUnit).toBeTruthy();
      expect(drug.specification).toBeTruthy();
    });
  });

  it('groups fluids and blood products by sub category', () => {
    const subCategories = new Set(seedFluidBloodDict.map((item) => item.subCategory));
    expect(subCategories.has('晶体液')).toBe(true);
    expect(subCategories.has('胶体液')).toBe(true);
    expect(subCategories.has('血液制品')).toBe(true);
    expect(subCategories.has('自体血回输')).toBe(true);
    const names = seedFluidBloodDict.map((item) => item.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('defines vital signs with unique short codes', () => {
    expect(seedVitalSignDict.length).toBeGreaterThanOrEqual(10);
    const codes = seedVitalSignDict.map((item) => item.shortCode);
    expect(new Set(codes).size).toBe(codes.length);
    expect(enabledVitalSigns(seedVitalSignDict).length).toBeGreaterThan(0);
  });
});
