import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = process.cwd();
const targets = [
  'src/views/Login.vue',
  'src/views/workbench/WorkbenchOverview.vue',
  'src/views/QualityDashboard.vue',
  'src/views/QualityDefects.vue',
  'src/views/SurgerySchedule.vue',
  'src/views/PatientAnesthesiaDetail.vue',
  'src/views/PacuList.vue',
  'src/views/PacuRecord.vue',
  'src/views/PacuTransfer.vue',
  'src/views/pacu/PacuAlerts.vue',
  'src/views/postoperative/PostoperativeAnalgesia.vue',
  'src/views/postoperative/PostoperativeFollowupPage.vue',
  'src/views/postoperative/PostoperativeComplications.vue',
  'src/views/postoperative/PostoperativeUnplannedEvents.vue',
  'src/views/system/SystemUsers.vue',
  'src/views/system/SystemRoles.vue',
  'src/views/system/SystemAudit.vue',
  'src/views/system/SystemIntegration.vue',
  'src/views/system/SystemMock.vue',
  'src/components/MetricCard.vue',
  'src/components/quality/IndicatorCard.vue',
  'src/components/quality/IndicatorTrendChart.vue',
  'src/components/VitalsChart.vue',
  'src/components/shared/DictCrudPanel.vue',
];

const hexColorRegex = /#[0-9a-fA-F]{3,8}\b/g;
const failures = [];

for (const relativePath of targets) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  const content = fs.readFileSync(absolutePath, 'utf8');
  const matches = [...content.matchAll(hexColorRegex)];
  if (matches.length) {
    failures.push({
      file: relativePath,
      colors: [...new Set(matches.map((item) => item[0]))],
    });
  }
}

if (failures.length) {
  console.error('Style guard failed: use tokens instead of hard-coded hex colors.');
  failures.forEach((entry) => {
    console.error(`- ${entry.file}: ${entry.colors.join(', ')}`);
  });
  process.exit(1);
}

console.log('Style guard passed for core commercialized UI files.');
