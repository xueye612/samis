<template>
  <ModulePageShell title="临床文书管理" description="文书生成、签名、归档和版本历史">
    <template #toolbar>
      <a-input v-model="operationId" placeholder="operationId" style="width: 240px" allow-clear />
      <a-button :loading="loading" @click="loadDocuments">加载文书列表</a-button>
    </template>

    <a-spin :loading="loading" style="width: 100%">
      <a-alert v-if="error" type="error" :title="error" closable @close="error = null" style="margin-bottom: 12px" />

      <EmptyState v-if="!operationId" title="请输入 operationId" description="输入手术ID后加载文书列表" icon="IconFile" />

      <template v-else>
        <a-card class="section-card" :bordered="false" title="文书列表">
          <a-table v-if="documents.length" :data="documents" row-key="documentId" :pagination="{ pageSize: 5 }" size="small">
            <template #columns>
              <a-table-column title="类型" data-index="documentType" :width="100" />
              <a-table-column title="版本" data-index="businessVersion" :width="60" align="center" />
              <a-table-column title="状态" :width="100">
                <template #cell="{ record }">
                  <a-tag :color="publishColor(record.publishStatus)">{{ publishLabel(record.publishStatus) }}</a-tag>
                </template>
              </a-table-column>
              <a-table-column title="内容哈希" :width="120">
                <template #cell="{ record }">
                  <a-tooltip :content="record.contentHash"><span class="muted">{{ record.contentHash?.slice(0, 12) }}…</span></a-tooltip>
                </template>
              </a-table-column>
              <a-table-column title="生成时间" data-index="generatedAt" :width="160" />
              <a-table-column title="归档时间" data-index="archivedAt" :width="160" />
              <a-table-column title="操作" :width="200" fixed="right">
                <template #cell="{ record }">
                  <a-space>
                    <a-button size="mini" @click="viewDocument(record)">详情</a-button>
                    <a-button size="mini" @click="viewSignatures(record)">签名</a-button>
                    <a-button v-if="record.publishStatus !== 'published'" size="mini" type="primary" :loading="archiving === record.documentId" @click="onArchive(record)">归档</a-button>
                    <a-tag v-if="record.publishStatus === 'published'" color="green">已归档</a-tag>
                  </a-space>
                </template>
              </a-table-column>
            </template>
          </a-table>
          <a-empty v-else description="暂无文书" />
        </a-card>
      </template>
    </a-spin>

    <!-- 文书详情弹窗 -->
    <a-modal v-model:visible="docModalVisible" title="文书详情" :footer="false" width="700px">
      <a-descriptions v-if="currentDoc" :column="2" bordered size="small">
        <a-descriptions-item label="文档ID">{{ currentDoc.documentId }}</a-descriptions-item>
        <a-descriptions-item label="类型">{{ currentDoc.documentType }}</a-descriptions-item>
        <a-descriptions-item label="版本">v{{ currentDoc.businessVersion }}</a-descriptions-item>
        <a-descriptions-item label="模板版本">{{ currentDoc.templateVersion }}</a-descriptions-item>
        <a-descriptions-item label="状态"><a-tag :color="publishColor(currentDoc.publishStatus)">{{ publishLabel(currentDoc.publishStatus) }}</a-tag></a-descriptions-item>
        <a-descriptions-item label="内容哈希"><span class="muted">{{ currentDoc.contentHash }}</span></a-descriptions-item>
        <a-descriptions-item label="PDF路径">{{ currentDoc.pdfPath ?? '未生成' }}</a-descriptions-item>
        <a-descriptions-item label="PDF哈希">{{ currentDoc.pdfHash ?? '—' }}</a-descriptions-item>
        <a-descriptions-item v-if="currentDoc.publishError" label="发布错误"><a-tag color="red">{{ currentDoc.publishError }}</a-tag></a-descriptions-item>
        <a-descriptions-item label="生成时间">{{ currentDoc.generatedAt ?? '—' }}</a-descriptions-item>
      </a-descriptions>
    </a-modal>

    <!-- 签名列表弹窗 -->
    <a-modal v-model:visible="sigModalVisible" title="签名列表" :footer="false" width="600px">
      <a-table v-if="currentSignatures.length" :data="currentSignatures" row-key="signatureId" size="small" :pagination="false">
        <template #columns>
          <a-table-column title="角色" data-index="signerRole" :width="100" />
          <a-table-column title="签署方式" :width="100">
            <template #cell="{ record }"><a-tag :color="record.signatureKind === 'ca' ? 'arcoblue' : 'orange'">{{ record.signatureKind === 'ca' ? 'CA' : '手写' }}</a-tag></template>
          </a-table-column>
          <a-table-column title="验证状态" :width="100">
            <template #cell="{ record }"><a-tag :color="record.verificationStatus === 'verified' ? 'green' : 'red'">{{ record.verificationStatus }}</a-tag></template>
          </a-table-column>
          <a-table-column title="签署时间" data-index="signedAt" :width="160" />
        </template>
      </a-table>
      <a-empty v-else description="暂无签名" />
    </a-modal>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import EmptyState from '@/components/shared/EmptyState.vue';
import { documentApi, type ClinicalDocumentApi, type DocumentSignatureApi } from '@/api/document';

const operationId = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const documents = ref<ClinicalDocumentApi[]>([]);
const archiving = ref<string | null>(null);
const docModalVisible = ref(false);
const sigModalVisible = ref(false);
const currentDoc = ref<ClinicalDocumentApi | null>(null);
const currentSignatures = ref<DocumentSignatureApi[]>([]);

const loadDocuments = async () => {
  if (!operationId.value) return;
  loading.value = true;
  error.value = null;
  try {
    const result = await documentApi.operationDocuments(operationId.value) as unknown as { list: ClinicalDocumentApi[]; total: number };
    documents.value = result.list ?? [];
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
    documents.value = [];
  } finally {
    loading.value = false;
  }
};

const viewDocument = (doc: ClinicalDocumentApi) => {
  currentDoc.value = doc;
  docModalVisible.value = true;
};

const viewSignatures = async (doc: ClinicalDocumentApi) => {
  try {
    const result = await documentApi.getSignatures(doc.documentId);
    currentSignatures.value = result.list;
    sigModalVisible.value = true;
  } catch (e) {
    Message.error(e instanceof Error ? e.message : '获取签名失败');
  }
};

const onArchive = async (doc: ClinicalDocumentApi) => {
  archiving.value = doc.documentId;
  try {
    const result = await documentApi.archive(doc.documentId) as unknown as { publishStatus: string; pdfHash?: string; idempotent?: boolean };
    Message.success(result.idempotent ? '文档已归档（幂等）' : '归档成功');
    await loadDocuments();
  } catch (e) {
    Message.error(e instanceof Error ? e.message : '归档失败');
  } finally {
    archiving.value = null;
  }
};

const publishColor = (status: string) => ({ published: 'green', not_published: 'gray', failed: 'red', pending: 'orange' }[status] ?? 'gray');
const publishLabel = (status: string) => ({ published: '已发布', not_published: '未发布', failed: '失败', pending: '发布中' }[status] ?? status);
</script>
