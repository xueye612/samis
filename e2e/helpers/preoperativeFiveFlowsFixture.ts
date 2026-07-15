import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DOCKER_CONTAINER = process.env.SAMIS_E2E_FIXTURE_CONTAINER ?? '1Panel-php8-B01L';
const AUTOLOAD = '/www/sites/api.cnwenhui.cn/index/vendor/autoload.php';
const FIXTURE = '/www/sites/api.cnwenhui.cn/index/tests/support/PreoperativeFiveFlowsFixture.php';

export interface PreopFixtureOutcome { status: string; operationId?: string; }

function phpSnippet(method: string, arg: string): string {
  return `require ${JSON.stringify(AUTOLOAD)}; require ${JSON.stringify(FIXTURE)}; (new think\\App())->initialize(); echo json_encode(tests\\support\\PreoperativeFiveFlowsFixture::${method}(${JSON.stringify(arg)}), JSON_UNESCAPED_UNICODE);`;
}

async function runFixture(method: string, arg: string): Promise<PreopFixtureOutcome> {
  const { stdout } = await execFileAsync('docker', ['exec', DOCKER_CONTAINER, 'php', '-r', phpSnippet(method, arg)], { encoding: 'utf8' });
  return JSON.parse(stdout.trim().split(/\r?\n/).pop() ?? '') as PreopFixtureOutcome;
}

export function generateOperationId(): string {
  return `OP-E2E-PREOP-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export async function cleanupPreop(operationId: string): Promise<PreopFixtureOutcome> {
  return runFixture('cleanupByOperationId', operationId);
}

export async function statusPreop(operationId: string): Promise<PreopFixtureOutcome> {
  return runFixture('statusByOperationId', operationId);
}
