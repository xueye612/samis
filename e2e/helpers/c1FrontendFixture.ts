import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const container = process.env.SAMIS_E2E_FIXTURE_CONTAINER ?? '1Panel-php8-B01L';
const autoload = '/www/sites/api.cnwenhui.cn/index/vendor/autoload.php';
const fixture = '/www/sites/api.cnwenhui.cn/index/tests/support/C1FrontendFixture.php';

export interface C1FrontendSetup {
  status: 'ready';
  prefix: string;
  username: string;
  token: string;
  operationId: string;
}

export interface C1FrontendStatus {
  status: 'absent' | 'present';
  counts: Record<string, number>;
}

function php(method: 'setup' | 'cleanup' | 'status', prefix: string): string {
  return `require ${JSON.stringify(autoload)}; require ${JSON.stringify(fixture)}; (new think\\App())->initialize(); echo json_encode(tests\\support\\C1FrontendFixture::${method}(${JSON.stringify(prefix)}), JSON_UNESCAPED_UNICODE);`;
}

async function run<T>(method: 'setup' | 'cleanup' | 'status', prefix: string): Promise<T> {
  const { stdout } = await execFileAsync('docker', ['exec', container, 'php', '-r', php(method, prefix)], { encoding: 'utf8' });
  const line = stdout.trim().split(/\r?\n/).pop() ?? '';
  return JSON.parse(line) as T;
}

export function c1FrontendPrefix(): string {
  return `C1-E2E-FE-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const setupC1Frontend = (prefix: string) => run<C1FrontendSetup>('setup', prefix);
export const cleanupC1Frontend = (prefix: string) => run<C1FrontendStatus>('cleanup', prefix);
export const statusC1Frontend = (prefix: string) => run<C1FrontendStatus>('status', prefix);
