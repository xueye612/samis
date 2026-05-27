import fs from 'fs';
import path from 'path';

const views = [
  ['workbench/WorkbenchRooms.vue', '手术间状态总览', 'cases'],
  ['workbench/WorkbenchTodos.vue', '我的待办', 'todos'],
  ['preoperative/PreoperativeRequests.vue', '手术申请接收', 'cases'],
  ['preoperative/PreoperativeConsultation.vue', '麻醉会诊', 'cases'],
  ['preoperative/PreoperativeExamReview.vue', '术前检查审核', 'cases'],
  ['preoperative/PreoperativeConsent.vue', '知情同意', 'cases'],
  ['preoperative/PreoperativeSafetyCheck.vue', '手术安全核查', 'cases'],
  ['surgery/AnesthesiaPlan.vue', '麻醉计划', 'cases'],
  ['surgery/SurgeryMedications.vue', '术中用药', 'cases'],
  ['surgery/SurgeryFluids.vue', '输液输血', 'cases'],
  ['surgery/SurgeryEvents.vue', '特殊事件/抢救记录', 'cases'],
  ['monitor/MonitorDashboard.vue', '手术间实时大屏', 'cases'],
  ['monitor/MonitorDevices.vue', '设备数据采集', 'cases'],
  ['monitor/MonitorAlerts.vue', '实时告警', 'qualityDefects'],
  ['pacu/PacuAlerts.vue', 'PACU质控预警', 'pacuPatients'],
  ['postoperative/PostoperativeAnalgesia.vue', '术后镇痛', 'followUps'],
  ['postoperative/PostoperativeFollowupPage.vue', '术后随访', 'followUps'],
  ['postoperative/PostoperativeComplications.vue', '并发症追踪', 'followUps'],
  ['postoperative/PostoperativeUnplannedEvents.vue', '非计划事件追踪', 'cases'],
  ['special/SpecialObstetric.vue', '产科分娩镇痛', 'cases'],
  ['special/SpecialNonOr.vue', '非手术室麻醉', 'cases'],
  ['quality/QualityOverview.vue', '质控总览', 'indicatorDetails'],
  ['quality/QualityHypothermia.vue', '低体温专项', 'indicatorDetails'],
  ['quality/QualityPacu.vue', 'PACU专项', 'indicatorDetails'],
  ['quality/QualityAdverseEvents.vue', '不良事件统计', 'qualityDataset'],
  ['quality/QualityReports.vue', '月度质控报表', 'qualityReportCache'],
  ['quality/QualityPdca.vue', 'PDCA持续改进', 'pdcaRecords'],
  ['reports/ReportsWorkload.vue', '工作量统计', 'cases'],
  ['reports/ReportsMethods.vue', '麻醉方式分析', 'cases'],
  ['reports/ReportsOperations.vue', '运营分析', 'cases'],
  ['config/ConfigRooms.vue', '手术间管理', 'configRooms'],
  ['config/ConfigStaff.vue', '麻醉人员', 'configStaff'],
  ['config/ConfigMethods.vue', '麻醉方式字典', 'configMethods'],
  ['config/ConfigDrugs.vue', '药品字典', 'configDrugs'],
  ['config/ConfigFluids.vue', '液体/血制品字典', 'configFluids'],
  ['config/ConfigEvents.vue', '事件字典', 'configEvents'],
  ['config/ConfigScores.vue', '评分模板', 'configScores'],
  ['config/ConfigPrint.vue', '打印模板', 'configPrintTemplates'],
  ['system/SystemUsers.vue', '用户管理', 'systemUsers'],
  ['system/SystemRoles.vue', '角色权限', 'roles'],
  ['system/SystemAudit.vue', '操作日志', 'auditLogs'],
  ['system/SystemIntegration.vue', '接口配置', 'integrationEndpoints'],
  ['system/SystemMock.vue', '数据模拟配置', 'mock'],
];

const pageTpl = (title, dataKey) => `<template>
  <div class="page-stack">
    <a-card class="section-card" :bordered="false" title="${title}">
      <a-table :data="rows" :pagination="{ pageSize: 8 }" row-key="id">
        <template #columns>
          <a-table-column title="名称/患者" data-index="label" />
          <a-table-column title="说明" data-index="desc" />
          <a-table-column title="操作" :width="120">
            <template #cell="{ record }"><a-button size="mini" type="primary" @click="go(record)">查看</a-button></template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAnesthesiaStore } from '@/stores/anesthesia';

interface RowItem { id: string; label: string; desc: string; link?: string }

const store = useAnesthesiaStore();
const router = useRouter();
const rows = computed(() => buildRows('${dataKey}'));

function buildRows(k: string): RowItem[] {
  if (k === 'todos') return store.todos.map((item) => ({ id: item.id, label: item.title, desc: item.category, link: item.caseId }));
  if (k === 'qualityDefects') return store.qualityDefects.map((item) => ({ id: item.defectId, label: item.defectType, desc: item.defectDesc, link: item.caseId }));
  if (k === 'indicatorDetails') return store.indicatorDetails.slice(0, 10).map((item) => ({ id: item.code, label: item.name, desc: String(item.displayValue), link: '' }));
  if (k === 'qualityReportCache') return store.qualityReportCache.map((item) => ({ id: item.period, label: item.period, desc: item.generatedAt, link: '' }));
  if (k === 'pdcaRecords') return store.pdcaRecords.map((item) => ({ id: item.id, label: item.title, desc: item.problem, link: '' }));
  if (k === 'auditLogs') return store.auditLogs.map((item) => ({ id: item.id, label: item.action, desc: item.detail, link: item.target }));
  if (k === 'integrationEndpoints') return store.integrationEndpoints.map((item) => ({ id: item.id, label: item.name, desc: item.endpoint, link: item.id }));
  if (k === 'systemUsers') return store.systemUsers.map((item) => ({ id: item.id, label: item.name, desc: item.role, link: '' }));
  if (k === 'pacuPatients') return store.pacuPatients.map((item) => ({ id: item.id, label: item.patientName, desc: item.room, link: item.caseId }));
  if (k === 'followUps') return store.followUps.map((item) => ({ id: item.id, label: item.type, desc: String(item.vas), link: item.caseId }));
  if (k === 'qualityDataset') return store.qualityDataset.events.filter((item) => item.isQualityEvent).map((item) => ({ id: item.eventId, label: item.eventType, desc: item.description, link: item.caseId }));
  if (k === 'roles') return [{ id: 'admin', label: '质控管理员', desc: '全部权限', link: '' }, { id: 'anes', label: '麻醉医师', desc: '临床操作', link: '' }];
  if (k === 'mock') return [{ id: 'seed', label: 'Mock 数据集', desc: 'qualitySeed + clinical 同步', link: '' }];
  return store.cases.map((item) => ({ id: item.id, label: item.patientName, desc: item.surgeryName, link: item.id }));
}

const go = (record: RowItem) => {
  if (record.link) router.push(\`/surgery/record/\${record.link}\`);
};
</script>
`.replace(/<\/?motion/g, (tag) => tag.replace('motion', 'motion'.replace('motion', 'div')));

views.forEach(([file, title, dataKey]) => {
  if (file.startsWith('config/') || file.includes('WorkbenchRooms') || file.includes('WorkbenchTodos') || file.includes('PostoperativeFollowupPage') || file.includes('QualityReports') || file.includes('QualityPdca') || file.includes('SystemIntegration')) return;
  fs.writeFileSync(path.join('src/views', file), pageTpl(title, dataKey));
});

console.log('regenerated page views');
