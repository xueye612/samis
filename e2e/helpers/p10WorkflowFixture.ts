import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const container = process.env.SAMIS_E2E_FIXTURE_CONTAINER ?? '1Panel-php8-B01L';
const root = '/www/sites/api.cnwenhui.cn/index';

async function php(code: string): Promise<Record<string, unknown>> {
  const { stdout } = await execFileAsync('docker', ['exec', '-w', root, container, 'php', '-r', code], { encoding: 'utf8' });
  return JSON.parse(stdout.trim().split(/\r?\n/).pop() ?? '{}') as Record<string, unknown>;
}

export function generateP10OperationId(): string {
  return `OP-E2E-P10-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export async function setupP10Operation(operationId: string): Promise<Record<string, unknown>> {
  const code = `require 'vendor/autoload.php';require 'tests/support/OperationScheduleFixture.php';(new think\\App())->initialize();echo json_encode(tests\\support\\OperationScheduleFixture::setup(${JSON.stringify(operationId)},['PATIENT_NAME'=>'P10浏览器合成患者']),JSON_UNESCAPED_UNICODE);`;
  return php(code);
}

export async function cleanupP10Operation(operationId: string): Promise<Record<string, unknown>> {
  const code = `require 'vendor/autoload.php';require 'tests/support/OperationScheduleFixture.php';(new think\\App())->initialize();$d=think\\facade\\Db::connect('samis');foreach(['anes_pacu_timeline','anes_pacu_score','anes_pacu_order','anes_pacu_record','anes_pacu_booking','anes_post_workflow_history','anes_post_followup','anes_post_complication','anes_post_unplanned_event','anes_post_analgesia_plan'] as $t){try{$d->table($t)->where('operation_id',${JSON.stringify(operationId)})->delete();}catch(Throwable $e){}}$r=tests\\support\\OperationScheduleFixture::cleanup(${JSON.stringify(operationId)});echo json_encode(['status'=>$r['visible']?'present':'absent'],JSON_UNESCAPED_UNICODE);`;
  return php(code);
}

export async function statusP10Operation(operationId: string): Promise<Record<string, unknown>> {
  const code = `require 'vendor/autoload.php';require 'tests/support/OperationScheduleFixture.php';(new think\\App())->initialize();$r=tests\\support\\OperationScheduleFixture::status(${JSON.stringify(operationId)});echo json_encode(['status'=>$r['visible']?'present':'absent'],JSON_UNESCAPED_UNICODE);`;
  return php(code);
}
