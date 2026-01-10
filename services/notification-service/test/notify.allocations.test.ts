import type { Request, Response } from 'express';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
const sendMailMock = vi.fn();
const createTransportMock = vi.fn(() => ({ sendMail: sendMailMock }));

vi.mock(
  '@humpline/shared',
  () => ({
    query: queryMock
  }),
  { virtual: true }
);

vi.mock('nodemailer', () => ({
  default: { createTransport: createTransportMock },
  createTransport: createTransportMock
}));

const originalEnv = { ...process.env };

async function loadModule(envOverrides: Record<string, string | undefined> = {}) {
  vi.resetModules();
  process.env = {
    ...originalEnv,
    NODE_ENV: 'test',
    SMTP_HOST: 'smtp.test',
    SMTP_PORT: '2525',
    SMTP_USER: 'smtp-user',
    SMTP_PASS: 'smtp-pass',
    NOTIFY_FROM: 'alerts@example.com',
    NOTIFY_TO: 'primary@example.com,backup@example.com',
    ...envOverrides
  };
  return import('../src/index.js');
}

function createMockRes() {
  const res: Partial<Response> & { body?: any; statusCode: number } = { statusCode: 200 };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res as Response;
  });
  res.json = vi.fn((payload: any) => {
    res.body = payload;
    return res as Response;
  });
  return res as Response & { body?: any; statusCode: number };
}

describe('POST /notify/allocations', () => {
  beforeEach(() => {
    queryMock.mockReset();
    sendMailMock.mockReset();
    createTransportMock.mockReset();
    createTransportMock.mockReturnValue({ sendMail: sendMailMock });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('sends allocation email using fallback recipients when DB is empty', async () => {
    const module = await loadModule();
    const { handleNotifyAllocations } = module;
    const tickId = '2024-05-01T00:00:00.000Z';

    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            weights_target: { BTC: 0.6, ETH: 0.4 },
            weights_current: {},
            total_equity_usd: 12500,
            holdings: { BTC: 0.25, ETH: 0.75 },
            tick_id: new Date(tickId)
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            weights_target: { BTC: 0.5, ETH: 0.5 },
            weights_current: {},
            total_equity_usd: 12000,
            holdings: { BTC: 0.2, ETH: 0.8 },
            tick_id: new Date('2024-04-30T00:00:00.000Z')
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [{ value: { enabled: false } }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            trade_id: 't1',
            symbol: 'BTC',
            side: 'BUY',
            qty: 1.23,
            notional_usd: 1234.56,
            ts: new Date(tickId)
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [{ started_at: new Date('2024-05-01T01:00:00.000Z'), status: 'SUCCESS' }]
      });

    const res = createMockRes();
    const req = { body: { model_id: 'model-1', tick_id: tickId } } as Request;

    await handleNotifyAllocations(req, res);

    expect(res.statusCode).toBe(200);
    expect(queryMock).toHaveBeenCalledTimes(6);
    expect(createTransportMock).toHaveBeenCalledWith({
      host: 'smtp.test',
      port: 2525,
      secure: false,
      auth: { user: 'smtp-user', pass: 'smtp-pass' }
    });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const mail = sendMailMock.mock.calls[0][0];
    expect(mail.from).toBe('alerts@example.com');
    expect(mail.to).toEqual(['dhumphrey11@gmail.com', 'primary@example.com', 'backup@example.com']);
    expect(String(mail.subject)).toContain('Allocation change (model-1)');
  });

  it('sends to the dedicated test inbox when test mode is enabled', async () => {
    const module = await loadModule({ NOTIFY_TO: 'prod@example.com' });
    const { handleNotifyAllocations } = module;
    const tickId = '2024-05-02T00:00:00.000Z';

    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            weights_target: { BTC: 0.5 },
            weights_current: {},
            total_equity_usd: 5000,
            holdings: { BTC: 0.1 },
            tick_id: new Date(tickId)
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            weights_target: { BTC: 0.5 },
            weights_current: {},
            total_equity_usd: 5000,
            holdings: { BTC: 0.1 },
            tick_id: new Date('2024-05-01T00:00:00.000Z')
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [{ value: { enabled: true } }] })
      .mockResolvedValueOnce({ rows: [{ value: { emails: ['prod@example.com'] } }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = createMockRes();
    const req = { body: { model_id: 'model-2', tick_id: tickId } } as Request;

    await handleNotifyAllocations(req, res);

    expect(res.statusCode).toBe(200);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const mail = sendMailMock.mock.calls[0][0];
    expect(mail.to).toEqual(['dhumphrey11@gmail.com']);
    expect(String(mail.subject)).toContain('[TEST]');
    expect(res.body?.test_mode).toBe(true);
  });
});
