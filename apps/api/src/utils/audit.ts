import { getDb } from '../firebase';

export async function writeAuditLog(
  adminUid: string,
  action: string,
  entityPath: string,
  before: unknown = null,
  after: unknown = null,
) {
  await getDb().collection('auditLogs').add({
    adminUid,
    action,
    entityPath,
    before,
    after,
    createdAt: new Date().toISOString(),
  });
}
