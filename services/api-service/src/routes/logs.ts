import express from 'express';
import { query } from '@humpline/shared';
import type { Request, Response } from 'express';

export const logsRouter = express.Router();

logsRouter.get('/', async (_req: Request, res: Response) => {
  const rows = await query(
    `SELECT id, created_at, actor, source, action, status, detail
     FROM action_logs
     ORDER BY created_at DESC
     LIMIT 100`
  );
  res.status(200).json(rows.rows);
});
