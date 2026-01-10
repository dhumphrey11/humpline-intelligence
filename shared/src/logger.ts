import { query } from './db.js';
import { v4 as uuidv4 } from 'uuid';

type LogStatus = 'SUCCESS' | 'FAILED' | 'INFO';

type LogDetail = Record<string, unknown>;

export async function logAction(params: {
  actor?: string | null;
  source: string;
  action: string;
  status: LogStatus;
  detail?: LogDetail;
}) {
  const { actor, source, action, status, detail = {} } = params;
  await query(
    `INSERT INTO action_logs (id, actor, source, action, status, detail)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [uuidv4(), actor ?? null, source, action, status, detail]
  );
}
