import { Message } from '@arco-design/web-vue';
import { anesthesiaDictApi } from '@/api/anesthesiaDict';
import { useRealAnesthesiaDict } from '@/config/apiFlags';
import { SamisHttpError } from '@/api/samisHttpClient';
import { mapDrugDictListResponse } from '@/services/anesthesia/adapters/anesthesiaDictAdapter';
import { drugDictItemToApi } from '@/services/drugDictMapper';
import { seedDrugDict } from '@/mock/configSeed';
import type { DrugDictItem } from '@/types/system';

export async function loadDrugDictCatalog(params?: {
  keyword?: string;
  enabled?: boolean;
  pageSize?: number;
}): Promise<{ items: DrugDictItem[]; source: 'remote' | 'mock' | 'seed' }> {
  const pageSize = params?.pageSize ?? 500;
  if (!useRealAnesthesiaDict()) {
    const raw = await anesthesiaDictApi.getDrugDict({
      enabled: params?.enabled ?? true,
      page: 1,
      pageSize,
      keyword: params?.keyword,
    });
    const items = mapDrugDictListResponse(raw);
    return { items: items.length ? items : [...seedDrugDict], source: 'mock' };
  }

  try {
    const raw = await anesthesiaDictApi.getDrugDict({
      keyword: params?.keyword,
      enabled: params?.enabled,
      page: 1,
      pageSize,
    });
    const items = mapDrugDictListResponse(raw);
    if (!items.length) {
      Message.info('远程药品字典为空');
    }
    return { items, source: 'remote' };
  } catch (error) {
    const msg = error instanceof SamisHttpError
      ? error.message
      : error instanceof Error
        ? error.message
        : '加载药品字典失败';
    Message.warning(msg);
    return { items: [], source: 'remote' };
  }
}

/** 新增/编辑单条；真实接口成功时合并服务端 drugId */
export async function persistDrugDictItem(item: DrugDictItem): Promise<DrugDictItem | null> {
  if (!useRealAnesthesiaDict()) return item;
  try {
    const saved = await anesthesiaDictApi.saveDrugDict(drugDictItemToApi(item));
    const drugId = saved?.drugId ?? item.id;
    return { ...item, id: drugId != null ? String(drugId) : item.id };
  } catch (error) {
    const msg = error instanceof SamisHttpError ? error.message : '保存药品字典失败';
    Message.error(msg);
    return null;
  }
}

export async function disableDrugDictItem(drugId: string | number): Promise<boolean> {
  if (!useRealAnesthesiaDict()) return true;
  try {
    await anesthesiaDictApi.disableDrugDict(drugId);
    return true;
  } catch (error) {
    const msg = error instanceof SamisHttpError ? error.message : '停用药品失败';
    Message.error(msg);
    return false;
  }
}