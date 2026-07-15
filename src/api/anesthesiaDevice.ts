import { samisRequest } from '@/api/samisClient';
import { buildFormPost, type FormRecord } from '@/api/samisFormBody';

export interface DeviceRegistryItem {
  deviceId: string;
  deviceType: string;
  vendor: string | null;
  model: string | null;
  protocolCode: string;
  status: 'online' | 'offline' | 'alert' | string;
  lastHeartbeatAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface DeviceAlertItem {
  alertId: string;
  operationId: string;
  deviceId: string;
  alertCode: string;
  severity: string;
  message: string;
  occurredAt: string | null;
  status: string;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  disposition: string | null;
}

function form(data: Record<string, string | number | boolean | undefined | null>): FormRecord {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && value !== null)) as FormRecord;
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== '') search.set(key, String(value)); });
  return search.size ? `?${search.toString()}` : '';
}

export const anesthesiaDeviceV2Api = {
  registryList(params: { status?: string; deviceType?: string; page?: number; pageSize?: number } = {}) {
    return samisRequest<{ list: DeviceRegistryItem[]; total: number }>(`/anesthesiaDeviceV2/registryList${query({ ...params, page_size: params.pageSize })}`, undefined, { module: 'anesthesiaDevice' });
  },
  registrySave(data: Record<string, string | number | boolean | undefined | null>) {
    return samisRequest<DeviceRegistryItem>('/anesthesiaDeviceV2/registrySave', buildFormPost(form(data)), { module: 'anesthesiaDevice' });
  },
  bind(data: { deviceId: string; operationId: string }) {
    return samisRequest<{ bindingId: string; deviceId: string; operationId: string; boundAt: string }>('/anesthesiaDeviceV2/bind', buildFormPost(form(data)), { module: 'anesthesiaDevice' });
  },
  unbind(data: { bindingId: string; reason: string }) {
    return samisRequest<{ bindingId: string; unboundAt: string }>('/anesthesiaDeviceV2/unbind', buildFormPost(form(data)), { module: 'anesthesiaDevice' });
  },
  alertList(params: { operationId?: string; deviceId?: string; status?: string; page?: number; pageSize?: number } = {}) {
    return samisRequest<{ list: DeviceAlertItem[]; total: number }>(`/anesthesiaDeviceV2/alertList${query({ ...params, page_size: params.pageSize })}`, undefined, { module: 'anesthesiaDevice' });
  },
  acknowledge(data: { alertId: string; dispositionType: string; disposition: string }) {
    return samisRequest<DeviceAlertItem>('/anesthesiaDeviceV2/alertAcknowledge', buildFormPost(form(data)), { module: 'anesthesiaDevice' });
  },
};
