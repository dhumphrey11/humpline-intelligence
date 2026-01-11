import { query } from './db.js';
import { v4 as uuidv4 } from 'uuid';

type LogStatus = 'SUCCESS' | 'FAILED' | 'INFO';

type LogDetail = Record<string, unknown>;

function summarizeDetail(status: LogStatus, detail: LogDetail): LogDetail {
  // Keep action log payloads concise for the dashboard.
  if (status === 'FAILED') {
    const error =
      (detail.error as string | undefined) ??
      (detail.message as string | undefined) ??
      (detail['response'] as any)?.error ??
      (detail['response'] as any)?.message ??
      JSON.stringify(detail);
    return { error };
  }

  if (status === 'SUCCESS') {
    const summary: LogDetail = {};
    for (const [key, value] of Object.entries(detail)) {
      if (Array.isArray(value)) {
        summary[key] = `${value.length} rows`;
      } else if (value && typeof value === 'object') {
        summary[key] = 'updated';
      } else {
        summary[key] = value;
      }
    }
    if (Object.keys(summary).length === 0) {
      summary.info = 'ok';
    }
    return summary;
  }

  return detail;
}

export async function logAction(params: {
  actor?: string | null;
  source: string;
  action: string;
  status: LogStatus;
  detail?: LogDetail;
}) {
  const { actor, source, action, status, detail = {} } = params;
  const condensed = summarizeDetail(status, detail);
  await query(
    `INSERT INTO action_logs (id, actor, source, action, status, detail)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [uuidv4(), actor ?? null, source, action, status, condensed]
  );
}
