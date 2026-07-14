import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * 手术主数据浏览器 E2E 合成病例生命周期助手。
 *
 * 通过 execFile 调用 index 容器内的 OperationMasterDataE2EFixtureCli（Task B），
 * 参数以数组形式传递，不拼接未校验的 shell 字符串。仅操作 OP-E2E-SCHEDULE-* 合成病例。
 */

const DOCKER_CONTAINER = process.env.SAMIS_E2E_FIXTURE_CONTAINER ?? '1Panel-php8-B01L';
const CLI_PATH = '/www/sites/api.cnwenhui.cn/index/tests/support/OperationMasterDataE2EFixtureCli.php';

export interface FixtureOutcome {
  action: string;
  ok: boolean;
  operationId: string;
  status: string;
  visible: boolean;
  operationDate?: string;
  roomCode?: string;
  roomGroup?: string;
  error?: string;
}

async function runCli(action: string, args: readonly string[]): Promise<FixtureOutcome> {
  // docker exec + php + CLI + action + 选项，全部以 argv 数组传递，避免 shell 注入
  const { stdout } = await execFileAsync('docker', [
    'exec', DOCKER_CONTAINER, 'php', CLI_PATH, action, ...args,
  ], { encoding: 'utf8' });
  const line = stdout.trim().split(/\r?\n/).pop() ?? '';
  const parsed = JSON.parse(line) as FixtureOutcome;
  if (!parsed.ok) {
    throw new Error(`fixture ${action} failed: ${parsed.error ?? 'unknown error'}`);
  }
  return parsed;
}

/** 测试端生成已知、唯一、长度不超过 50 的 OP-E2E-SCHEDULE-* operationId（在 setup 之前确定）。 */
export function generateMasterDataOperationId(): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  const id = `OP-E2E-SCHEDULE-${stamp}${rand}`;
  return id.length <= 50 ? id : `${id.slice(0, 50)}`;
}

/** setup 显式 operationId 的 OP-E2E-SCHEDULE-* 合成病例；operationId 由调用方先确定。 */
export async function setupMasterDataFixture(
  operationId: string,
  roomCode: string,
  roomGroup: string,
): Promise<FixtureOutcome> {
  return runCli('setup', [`--operationId=${operationId}`, `--roomCode=${roomCode}`, `--roomGroup=${roomGroup}`]);
}

export async function statusMasterDataFixture(operationId: string): Promise<FixtureOutcome> {
  return runCli('status', [`--operationId=${operationId}`]);
}

export async function cleanupMasterDataFixture(operationId: string): Promise<FixtureOutcome> {
  return runCli('cleanup', [`--operationId=${operationId}`]);
}
