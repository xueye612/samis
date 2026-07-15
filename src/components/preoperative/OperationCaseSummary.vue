<template>
  <a-descriptions :column="3" size="small" bordered>
    <a-descriptions-item label="患者">{{ caseData?.patientName || '—' }}</a-descriptions-item>
    <a-descriptions-item label="住院号">{{ caseData?.patientNumber || '—' }}</a-descriptions-item>
    <a-descriptions-item label="性别">{{ caseData?.patientSex || '—' }}</a-descriptions-item>
    <a-descriptions-item label="年龄">{{ caseData?.patientAge || '—' }}</a-descriptions-item>
    <a-descriptions-item label="科室">{{ caseData?.department || '—' }}</a-descriptions-item>
    <a-descriptions-item label="诊断">{{ caseData?.diagnosis || caseData?.preoperativeDiagnosis || '—' }}</a-descriptions-item>
    <a-descriptions-item label="手术">{{ caseData?.surgeryName || caseData?.operationName || '—' }}</a-descriptions-item>
    <a-descriptions-item label="计划日期">{{ caseData?.scheduledDate || caseData?.operationDate || '—' }}</a-descriptions-item>
    <a-descriptions-item label="operationId">{{ caseData?.operationId || '—' }}</a-descriptions-item>
  </a-descriptions>
</template>

<script setup lang="ts">
defineProps<{ caseData: Record<string, unknown> | null }>();
</script>
