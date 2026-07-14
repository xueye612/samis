import { samisRequest } from '@/api/samisClient';
import { buildFormPost, flatFormFieldsFromRecord } from '@/api/samisFormBody';

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
  options: string | null;
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
      buildFormPost(flatFormFieldsFromRecord(data)),
      { module: 'room' },
    );
  },
};
