import { samisRequest } from '@/api/samisClient';
import { buildFormPost } from '@/api/samisFormBody';

export interface ClinicalDocumentApi {
  documentId: string;
  operationId: string;
  documentType: string;
  businessRecordId: string;
  businessVersion: number;
  templateVersion: string;
  contentHash: string;
  pdfPath: string | null;
  pdfHash: string | null;
  huliDocId: string | null;
  publishStatus: string;
  publishError: string | null;
  status: string;
  generatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
}

export interface DocumentSignatureApi {
  signatureId: string;
  documentId: string;
  signerId: string | null;
  signerRole: string;
  signerRelationship: string | null;
  witnessId: string | null;
  signatureProvider: string;
  providerSignatureId: string | null;
  signatureKind: string;
  certificateId: string | null;
  attachmentId: string | null;
  attachmentHash: string | null;
  contentHash: string;
  verificationStatus: string;
  signedAt: string;
  supersededAt: string | null;
}

export interface SecureAttachmentApi {
  attachmentId: string;
  operationId: string;
  purpose: string;
  storageKey: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  imageWidth: number | null;
  imageHeight: number | null;
  uploadedBy: string;
  uploadedAt: string;
}

export const documentApi = {
  prepare(data: {
    operationId: string;
    documentType: string;
    businessRecordId: string;
    businessVersion: number;
    templateVersion?: string;
    payload: Record<string, unknown>;
  }) {
    const { payload, ...rest } = data;
    return samisRequest<{ documentId: string; contentHash: string; status: string }>(
      '/document/prepare', buildFormPost({ ...rest, payload: JSON.stringify(payload) }), { module: 'document' },
    );
  },
  attachCaSignature(data: { documentId: string; signerGh: string; signerRole: string }) {
    return samisRequest<unknown>('/document/attachCaSignature', buildFormPost(data), { module: 'document' });
  },
  attachHandwrittenSignature(data: {
    documentId: string;
    signerRole: string;
    attachmentId: string;
    attachmentHash: string;
    relationship?: string;
    witnessId?: string;
  }) {
    return samisRequest<unknown>('/document/attachHandwrittenSignature', buildFormPost(data), { module: 'document' });
  },
  withdrawSignatures(data: { documentId: string; reason: string }) {
    return samisRequest<null>('/document/withdrawSignatures', buildFormPost(data), { module: 'document' });
  },
  getDocument(documentId: string) {
    return samisRequest<ClinicalDocumentApi>(
      `/document/getDocument?documentId=${encodeURIComponent(documentId)}`, undefined, { module: 'document' },
    );
  },
  getSignatures(documentId: string) {
    return samisRequest<{ list: DocumentSignatureApi[] }>(
      `/document/getSignatures?documentId=${encodeURIComponent(documentId)}`, undefined, { module: 'document' },
    );
  },
  attachmentCreate(data: {
    operationId: string;
    purpose: string;
    storageKey: string;
    mimeType: string;
    byteSize: number;
    sha256: string;
    imageWidth?: number;
    imageHeight?: number;
  }) {
    return samisRequest<SecureAttachmentApi>('/document/attachmentCreate', buildFormPost(data), { module: 'document' });
  },
  attachmentGetById(attachmentId: string) {
    return samisRequest<SecureAttachmentApi>(
      `/document/attachmentGetById?attachmentId=${encodeURIComponent(attachmentId)}`, undefined, { module: 'document' },
    );
  },
  attachmentList(operationId: string, purpose = '') {
    const q = `operationId=${encodeURIComponent(operationId)}${purpose ? `&purpose=${encodeURIComponent(purpose)}` : ''}`;
    return samisRequest<{ list: SecureAttachmentApi[] }>(`/document/attachmentList?${q}`, undefined, { module: 'document' });
  },
  operationDocuments(operationId: string, documentType = '', page = 1, pageSize = 20) {
    const q = `operationId=${encodeURIComponent(operationId)}${documentType ? `&documentType=${encodeURIComponent(documentType)}` : ''}&page=${page}&page_size=${pageSize}`;
    return samisRequest<{ list: ClinicalDocumentApi[]; total: number }>(`/document/operationDocuments?${q}`, undefined, { module: 'document' });
  },
  archive(documentId: string) {
    return samisRequest<{ documentId: string; publishStatus: string; pdfHash?: string; idempotent?: boolean }>('/document/archive', buildFormPost({ documentId }), { module: 'document' });
  },
};
