import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * 专业字典浏览器 E2E 合成记录生命周期助手。
 *
 * 通过 docker exec + php -r 调用 index 容器内的 tests/support/ProfessionalDictionaryFixture，
 * 仅操作 STAFF-E2E-* / METHOD-E2E-* / EVENT-E2E-* / SCORE-E2E-* 合成记录。
 */

const DOCKER_CONTAINER = process.env.SAMIS_E2E_FIXTURE_CONTAINER ?? '1Panel-php8-B01L';
const AUTOLOAD = '/www/sites/api.cnwenhui.cn/index/vendor/autoload.php';
const FIXTURE = '/www/sites/api.cnwenhui.cn/index/tests/support/ProfessionalDictionaryFixture.php';

export interface ProDictFixtureOutcome {
  status: string;
  id?: number;
  version?: number;
  staffStatus?: string;
  itemStatus?: string;
  historyRows?: number;
  error?: string;
}

function phpSnippet(method: string, arg: string): string {
  return `require ${JSON.stringify(AUTOLOAD)}; require ${JSON.stringify(FIXTURE)}; (new think\\App())->initialize(); echo json_encode(tests\\support\\ProfessionalDictionaryFixture::${method}(${JSON.stringify(arg)}), JSON_UNESCAPED_UNICODE);`;
}

async function runFixture(method: string, arg: string): Promise<ProDictFixtureOutcome> {
  const { stdout } = await execFileAsync('docker', [
    'exec', DOCKER_CONTAINER, 'php', '-r', phpSnippet(method, arg),
  ], { encoding: 'utf8' });
  const line = stdout.trim().split(/\r?\n/).pop() ?? '';
  return JSON.parse(line) as ProDictFixtureOutcome;
}

export function generateStaffGh(): string {
  return `STAFF-E2E-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}
export function generateDictCode(prefix: 'METHOD' | 'EVENT' | 'SCORE'): string {
  return `${prefix}-E2E-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export async function cleanupStaff(gh: string): Promise<ProDictFixtureOutcome> {
  return runFixture('cleanupStaffByGh', gh);
}
export async function cleanupDictItem(code: string): Promise<ProDictFixtureOutcome> {
  return runFixture('cleanupDictItemByCode', code);
}
export async function staffStatus(gh: string): Promise<ProDictFixtureOutcome> {
  return runFixture('staffStatus', gh);
}
export async function dictItemStatus(code: string): Promise<ProDictFixtureOutcome> {
  return runFixture('dictItemStatus', code);
}
