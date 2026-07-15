import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const container = process.env.SAMIS_E2E_FIXTURE_CONTAINER ?? '1Panel-php8-B01L';
const workdir = '/www/sites/api.cnwenhui.cn/index';
const bootstrap = `require 'vendor/autoload.php'; require 'tests/support/OperationScheduleFixture.php'; (new think\\App())->initialize();`;

async function run(code: string): Promise<Record<string, unknown>> {
  const { stdout } = await execFileAsync('docker', ['exec', '-w', workdir, container, 'php', '-r', code], { encoding: 'utf8' });
  return JSON.parse(stdout.trim().split(/\r?\n/).pop() ?? '{}');
}

export function generateP09OperationId(): string {
  return `OP-E2E-P09-WEB-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export async function setupP09Fixture(operationId: string) {
  return run(`${bootstrap} echo json_encode(tests\\support\\OperationScheduleFixture::setup(${JSON.stringify(operationId)}, ['OPERATINGROOM_CODE'=>'OP-E2E-OR','OPERATINGROOM_NAME'=>'E2E手术间','ROOM_GROUP'=>'OP-E2E-GROUP']), JSON_UNESCAPED_UNICODE);`);
}

export async function cleanupP09Fixture(operationId: string) {
  return run(`${bootstrap} $id=${JSON.stringify(operationId)}; $db=think\\facade\\Db::connect('samis'); $versions=$db->table('anes_anesthesia_handover')->where('operation_id',$id)->column('handover_version_id'); if($versions){$db->table('anes_anesthesia_handover_check')->whereIn('handover_version_id',$versions)->delete();} foreach(['anes_anesthesia_handover','anes_anesthesia_summary','anes_record_revision','anes_record'] as $t){$db->table($t)->where('operation_id',$id)->delete();} tests\\support\\OperationScheduleFixture::cleanup($id); echo json_encode(['status'=>'absent'], JSON_UNESCAPED_UNICODE);`);
}

export async function statusP09Fixture(operationId: string) {
  return run(`${bootstrap} $id=${JSON.stringify(operationId)}; $db=think\\facade\\Db::connect('samis'); $count=0; foreach(['anes_anesthesia_handover','anes_anesthesia_summary','anes_record'] as $t){$count+=(int)$db->table($t)->where('operation_id',$id)->count();} $op=tests\\support\\OperationScheduleFixture::status($id); echo json_encode(['status'=>($count===0&&empty($op['visible']))?'absent':'present'], JSON_UNESCAPED_UNICODE);`);
}
