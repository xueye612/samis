import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DOCKER_CONTAINER = process.env.SAMIS_E2E_FIXTURE_CONTAINER ?? '1Panel-php8-B01L';
const AUTOLOAD = '/www/sites/api.cnwenhui.cn/index/vendor/autoload.php';
const FIXTURE = '/www/sites/api.cnwenhui.cn/index/tests/support/ClinicalDictionaryFixture.php';

export interface ClinicalFixtureOutcome { status: string; id?: number; version?: number; entityStatus?: string; }

function phpSnippet(method: string, arg: string): string {
  return `require ${JSON.stringify(AUTOLOAD)}; require ${JSON.stringify(FIXTURE)}; (new think\\App())->initialize(); echo json_encode(tests\\support\\ClinicalDictionaryFixture::${method}(${JSON.stringify(arg)}), JSON_UNESCAPED_UNICODE);`;
}

async function runFixture(method: string, arg: string): Promise<ClinicalFixtureOutcome> {
  const { stdout } = await execFileAsync('docker', ['exec', DOCKER_CONTAINER, 'php', '-r', phpSnippet(method, arg)], { encoding: 'utf8' });
  return JSON.parse(stdout.trim().split(/\r?\n/).pop() ?? '') as ClinicalFixtureOutcome;
}

export function generateCode(prefix: 'DRUG' | 'FLUID' | 'BLOOD' | 'VITAL' | 'TPL'): string {
  return `${prefix}-E2E-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export async function cleanupClinical(code: string): Promise<ClinicalFixtureOutcome> { return runFixture('cleanupByCode', code); }
export async function statusClinical(code: string): Promise<ClinicalFixtureOutcome> { return runFixture('statusByCode', code); }
