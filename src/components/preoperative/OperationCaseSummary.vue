<template>
  <a-descriptions :column="3" size="small" bordered>
    <a-descriptions-item label="患者">{{ caseData?.patientName || '—' }}</a-descriptions-item>
    <a-descriptions-item label="住院号">{{ caseData?.patientNo || caseData?.visitNo || '—' }}</a-descriptions-item>
    <a-descriptions-item label="性别">{{ caseData?.gender || '—' }}</a-descriptions-item>
    <a-descriptions-item label="年龄">{{ caseData?.age == null ? '—' : `${caseData.age}${caseData.ageUnit || ''}` }}</a-descriptions-item>
    <a-descriptions-item label="科室">{{ caseData?.departmentName || '—' }}</a-descriptions-item>
    <a-descriptions-item label="诊断">{{ caseData?.preoperativeDiagnosisName || '—' }}</a-descriptions-item>
    <a-descriptions-item label="手术">{{ caseData?.plannedOperationName || caseData?.operationName || '—' }}</a-descriptions-item>
    <a-descriptions-item label="计划日期">{{ caseData?.plannedStartTime || caseData?.operationDate || '—' }}</a-descriptions-item>
    <a-descriptions-item label="operationId">{{ caseData?.operationId || '—' }}</a-descriptions-item>
  </a-descriptions>
</template>

<script setup lang="ts">
import type { OperationCase } from '@/services/anesthesia/adapters/operationInfoAdapter';
defineProps<{ caseData: OperationCase | null }>();
</script>
