import { samisRequest } from '@/api/samisClient';
import { formPostInit } from '@/api/samisFormBody';

export interface HospitalFieldConfigEntry {
  fieldCode: string;
  displayName: string;
  dataType: string;
  serverRequired: boolean;
  systemField: boolean;
  visible: boolean;
  required: boolean;
  sortNo: number;
  groupName: string | null;
  defaultValue: string | null;
  options: string | string[] | null;
  version: number | null;
  id: number | null;
  updatedAt: string | null;
}

export const configurationApi = {
  fieldConfig(hospitalCode: string, entityType = 'room') {
    const query = new URLSearchParams({ hospitalCode, entityType });
    return samisRequest<{ list: HospitalFieldConfigEntry[] }>(
      `/configuration/fieldConfig?${query.toString()}`,
      undefined,
      { module: 'room' },
    );
  },
  fieldConfigSave(data: Record<string, unknown>) {
    return samisRequest<{ id: number; fieldCode: string; version: number; updatedAt: string }>(
      '/configuration/fieldConfigSave',
      formPostInit(flattenFieldConfigFields(data)),
      { module: 'room' },
    );
  },
};

function flattenFieldConfigFields(data: Record<string, unknown>): string {
  const params = new URLSearchParams();
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(`${key}[]`, String(item)));
      return;
    }
    if (typeof value === 'object') return;
    params.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  });
  return params.toString();
}
