import { connectDatabase, pool } from './connection';
import { AuditLogService, resolveRetentionDays } from '../services/auditLog';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const retentionFlag = args.find((a) => a.startsWith('--retention-days='));
  const retentionFromFlag = retentionFlag ? Number(retentionFlag.split('=')[1]) : null;

  const days = retentionFromFlag !== null && Number.isInteger(retentionFromFlag) && retentionFromFlag > 0
    ? retentionFromFlag
    : resolveRetentionDays();

  console.log(`[prune-audit-logs] retention=${days} days, dryRun=${dryRun}`);

  await connectDatabase();

  try {
    const count = await AuditLogService.pruneOlderThan(days, dryRun);
    if (dryRun) {
      console.log(`[prune-audit-logs] dry-run: ${count} rows would be deleted`);
    } else {
      console.log(`[prune-audit-logs] deleted ${count} rows`);
      // 削除実行ログを audit_logs 自身に記録
      await AuditLogService.log({
        admin_id_snapshot: -1,
        admin_id: null,
        admin_username: 'system:prune-audit-logs',
        action: 'DELETE',
        resource_type: 'audit_log',
        http_method: 'CLI',
        endpoint: 'prune-audit-logs',
        status_code: 200,
        details: { row_count: count },
      });
    }
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('[prune-audit-logs] failed:', error);
    await pool.end();
    process.exit(1);
  }
}

main();
