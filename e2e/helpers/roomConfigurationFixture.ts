import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * 手术间配置浏览器 E2E 合成房间生命周期助手。
 *
 * 通过 docker exec + php -r 调用 index 容器内的 tests/support/RoomConfigurationFixture，
 * 仅操作 ROOM-E2E-* 合成房间。不输出连接信息或凭据。
 */

const DOCKER_CONTAINER = process.env.SAMIS_E2E_FIXTURE_CONTAINER ?? '1Panel-php8-B01L';
const AUTOLOAD = '/www/sites/api.cnwenhui.cn/index/vendor/autoload.php';
const FIXTURE = '/www/sites/api.cnwenhui.cn/index/tests/support/RoomConfigurationFixture.php';

export interface RoomFixtureOutcome {
  status: string;
  roomCode?: string;
  roomId?: number;
  version?: number;
  roomStatus?: string;
  capabilities?: number;
  historyRows?: number;
  error?: string;
}

export interface FieldConfigFixtureOutcome {
  status: 'present' | 'absent';
  rows: number;
}

function phpSnippet(method: string, arg: string): string {
  return `require ${JSON.stringify(AUTOLOAD)}; require ${JSON.stringify(FIXTURE)}; (new think\\App())->initialize(); echo json_encode(tests\\support\\RoomConfigurationFixture::${method}(${JSON.stringify(arg)}), JSON_UNESCAPED_UNICODE);`;
}

async function runFixture(method: string, arg: string): Promise<RoomFixtureOutcome> {
  const { stdout } = await execFileAsync('docker', [
    'exec', DOCKER_CONTAINER, 'php', '-r', phpSnippet(method, arg),
  ], { encoding: 'utf8' });
  const line = stdout.trim().split(/\r?\n/).pop() ?? '';
  return JSON.parse(line) as RoomFixtureOutcome;
}

/** 测试端生成唯一 ROOM-E2E-* 合成房间编码（≤64）。 */
export function generateRoomCode(): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  const code = `ROOM-E2E-${stamp}${rand}`;
  return code.length <= 64 ? code : code.slice(0, 64);
}

export async function cleanupRoomFixture(roomCode: string): Promise<RoomFixtureOutcome> {
  return runFixture('cleanupByCode', roomCode);
}

export async function statusRoomFixture(roomCode: string): Promise<RoomFixtureOutcome> {
  return runFixture('statusByCode', roomCode);
}

async function runFieldConfigFixture(action: 'cleanup' | 'status'): Promise<FieldConfigFixtureOutcome> {
  const php = [
    `require ${JSON.stringify(AUTOLOAD)}`,
    '(new think\\App())->initialize()',
    "$db = think\\facade\\Db::connect('samis')->table('anes_hospital_field_config')->where('hospital_code', 'E2E')->where('entity_type', 'room')",
    action === 'cleanup' ? '$db->delete()' : null,
    "$count = think\\facade\\Db::connect('samis')->table('anes_hospital_field_config')->where('hospital_code', 'E2E')->where('entity_type', 'room')->count()",
    "echo json_encode(['status' => $count === 0 ? 'absent' : 'present', 'rows' => (int)$count], JSON_UNESCAPED_UNICODE)",
  ].filter(Boolean).join('; ') + ';';
  const { stdout } = await execFileAsync('docker', [
    'exec', DOCKER_CONTAINER, 'php', '-r', php,
  ], { encoding: 'utf8' });
  const line = stdout.trim().split(/\r?\n/).pop() ?? '';
  return JSON.parse(line) as FieldConfigFixtureOutcome;
}

/** 仅清理 hospital_code=E2E、entity_type=room 的浏览器合成字段配置。 */
export async function cleanupFieldConfigFixture(): Promise<FieldConfigFixtureOutcome> {
  return runFieldConfigFixture('cleanup');
}

export async function statusFieldConfigFixture(): Promise<FieldConfigFixtureOutcome> {
  return runFieldConfigFixture('status');
}
