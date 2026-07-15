import { samisRequest } from '@/api/samisClient';
import { buildFormPost, flatFormFieldsFromRecord } from '@/api/samisFormBody';

export interface PacuListQuery {
  status?: string;
  room?: string;
  caseId?: string;
  pacuInTimeStart?: string;
  pacuInTimeEnd?: string;
  page?: number;
  pageSize?: number;
}

function buildListQuery(params: PacuListQuery = {}): string {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.room) query.set('room', params.room);
  if (params.caseId) query.set('caseId', params.caseId);
  if (params.pacuInTimeStart) query.set('pacuInTimeStart', params.pacuInTimeStart);
  if (params.pacuInTimeEnd) query.set('pacuInTimeEnd', params.pacuInTimeEnd);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('page_size', String(params.pageSize));
  const text = query.toString();
  return text ? `?${text}` : '';
}

function pacuFormPost<T>(path: string, data: Record<string, unknown>) {
  return samisRequest<T>(`/pacu${path}`, buildFormPost(flatFormFieldsFromRecord(data)), {
    module: 'pacu',
  });
}

export interface PacuBookingListQuery {
  status?: string;
  pacuRoomId?: string;
  caseId?: string;
  bookingTimeStart?: string;
  bookingTimeEnd?: string;
  page?: number;
  pageSize?: number;
}

function buildBookingListQuery(params: PacuBookingListQuery = {}): string {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.pacuRoomId) query.set('pacuRoomId', params.pacuRoomId);
  if (params.caseId) query.set('caseId', params.caseId);
  if (params.bookingTimeStart) query.set('bookingTimeStart', params.bookingTimeStart);
  if (params.bookingTimeEnd) query.set('bookingTimeEnd', params.bookingTimeEnd);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('page_size', String(params.pageSize));
  const text = query.toString();
  return text ? `?${text}` : '';
}

export const pacuApi = {
  detail(operationId: string) {
    return samisRequest<unknown>(`/pacu/detail?operationId=${encodeURIComponent(operationId)}`, undefined, { module: 'pacu' });
  },
  getList(params: PacuListQuery = {}) {
    return samisRequest<unknown>(`/pacu/list${buildListQuery(params)}`, undefined, {
      module: 'pacu',
    });
  },
  getById(id: number | string) {
    return samisRequest<unknown>(`/pacu/getById?id=${encodeURIComponent(String(id))}`, undefined, {
      module: 'pacu',
    });
  },
  admit(data: Record<string, unknown>) {
    return pacuFormPost<{ id: number }>('/admit', data);
  },
  saveRecovery(data: Record<string, unknown>) { return pacuFormPost<unknown>('/saveRecovery', data); },
  markReady(data: Record<string, unknown>) { return pacuFormPost<unknown>('/markReady', data); },
  discharge(data: Record<string, unknown>) { return pacuFormPost<unknown>('/discharge', data); },
  void(data: Record<string, unknown>) { return pacuFormPost<unknown>('/void', data); },
  update(data: Record<string, unknown>) {
    return pacuFormPost<void>('/update', data);
  },
  transferOut(data: Record<string, unknown>) {
    return pacuFormPost<void>('/transferOut', data);
  },
  bookingList(params: PacuBookingListQuery = {}) {
    return samisRequest<unknown>(`/pacu/bookingList${buildBookingListQuery(params)}`, undefined, {
      module: 'pacu',
    });
  },
  bookingGetById(id: number | string) {
    return samisRequest<unknown>(
      `/pacu/bookingGetById?id=${encodeURIComponent(String(id))}`,
      undefined,
      { module: 'pacu' },
    );
  },
  bookingCreate(data: Record<string, unknown>) {
    return pacuFormPost<{ id: number }>('/bookingCreate', data);
  },
  bookingUpdate(data: Record<string, unknown>) {
    return pacuFormPost<void>('/bookingUpdate', data);
  },
  bookingCancel(data: Record<string, unknown> | string | number) {
    return pacuFormPost<void>('/bookingCancel', typeof data === 'object' ? data : { id: data });
  },

  bedList(params: { roomId?: string; status?: string; page?: number; pageSize?: number } = {}) {
    const query = new URLSearchParams();
    if (params.roomId) query.set('roomId', params.roomId);
    if (params.status) query.set('status', params.status);
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('page_size', String(params.pageSize));
    const text = query.toString();
    return samisRequest<unknown>(`/pacu/bedList${text ? `?${text}` : ''}`, undefined, { module: 'pacu' });
  },
  bedAllGrouped() {
    return samisRequest<unknown>('/pacu/bedAllGrouped', undefined, { module: 'pacu' });
  },
  bedGetById(id: number | string) {
    return samisRequest<unknown>(`/pacu/bedGetById?id=${encodeURIComponent(String(id))}`, undefined, { module: 'pacu' });
  },
  bedStats() {
    return samisRequest<unknown>('/pacu/bedStats', undefined, { module: 'pacu' });
  },
  bedCreate(data: Record<string, unknown>) {
    return pacuFormPost<{ id: number }>('/bedCreate', data);
  },
  bedUpdate(data: Record<string, unknown>) {
    return pacuFormPost<void>('/bedUpdate', data);
  },
  bedDelete(id: number | string) {
    return pacuFormPost<void>('/bedDelete', { id });
  },

  // ---- P3-04 扩展：分项评分、医嘱、强制出室 ----
  scoreList(operationId: string) {
    return samisRequest<{ list: unknown[] }>(`/pacu/scoreList?operationId=${encodeURIComponent(operationId)}`, undefined, { module: 'pacu' });
  },
  scoreCreate(data: Record<string, unknown>) {
    return pacuFormPost<unknown>('/scoreCreate', data);
  },
  orderList(operationId: string) {
    return samisRequest<{ list: unknown[] }>(`/pacu/orderList?operationId=${encodeURIComponent(operationId)}`, undefined, { module: 'pacu' });
  },
  orderCreate(data: Record<string, unknown>) {
    return pacuFormPost<unknown>('/orderCreate', data);
  },
  orderStop(orderId: string, reason = '') {
    return pacuFormPost<unknown>('/orderStop', { orderId, reason });
  },
  orderExecute(data: Record<string, unknown>) {
    return pacuFormPost<unknown>('/orderExecute', data);
  },
  orderExecutions(orderId: string) {
    return samisRequest<{ list: unknown[] }>(`/pacu/orderExecutions?orderId=${encodeURIComponent(orderId)}`, undefined, { module: 'pacu' });
  },
  forceDischarge(data: Record<string, unknown> | string, reason?: string, reasonCode?: string, approverId?: string) {
    return pacuFormPost<unknown>('/forceDischarge', typeof data === 'object' ? data : { operationId: data, reason, reasonCode, approverId });
  },
};
