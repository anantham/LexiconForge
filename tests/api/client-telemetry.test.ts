import { describe, expect, it, vi } from 'vitest';

const createResponse = () => {
  const response = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as unknown,
    setHeader: vi.fn((name: string, value: string) => {
      response.headers[name] = value;
    }),
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    json(payload: unknown) {
      response.body = payload;
      return response;
    },
  };

  return response;
};

describe('api/client-telemetry', () => {
  it('rejects non-POST methods', async () => {
    const { default: handler } = await import('../../api/client-telemetry.js');
    const response = createResponse();

    handler({ method: 'GET' } as any, response as any);

    expect(response.setHeader).toHaveBeenCalledWith('Allow', 'POST');
    expect(response.statusCode).toBe(405);
    expect(response.body).toEqual({
      ok: false,
      error: 'Method not allowed. Use POST.',
    });
  });

  it('rejects invalid payloads', async () => {
    const { default: handler } = await import('../../api/client-telemetry.js');
    const response = createResponse();

    handler({ method: 'POST', body: '{"not":"enough"}' } as any, response as any);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      ok: false,
      error: 'Missing required field: event_type.',
    });
  });

  it('accepts a valid telemetry event payload', async () => {
    const { default: handler } = await import('../../api/client-telemetry.js');
    const response = createResponse();

    handler(
      {
        method: 'POST',
        body: {
          event_type: 'translation_failed',
          failure_type: 'unknown',
          surface: 'auto_visit',
          expected: false,
          user_visible: true,
        },
      } as any,
      response as any
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
    });
    expect(response.body).toHaveProperty('receivedAt');
  });
});

describe('telemetry abuse boundaries', () => {
  const valid = { event_type: 'translation_failed', failure_type: 'unknown', surface: 'auto_visit', expected: false, user_visible: true };
  it.each([
    { event_type: 'arbitrary '.repeat(100) },
    { failure_type: 'attacker-controlled log text' },
    { surface: 'https://private-url.example?token=synthetic' },
    { user_visible: 'true' },
  ])('rejects unknown or oversized field values without logging %s', async (fields) => {
    const { createTelemetryHandler } = await import('../../api/client-telemetry.js');
    const log = vi.fn(), handler = createTelemetryHandler({ log });
    const response = createResponse();
    handler({ method: 'POST', body: { ...valid, ...fields } }, response);
    expect(response.statusCode).toBe(400); expect(log).not.toHaveBeenCalled();
  });
  it('caps bytes and rejects invalid JSON without logging', async () => {
    const { createTelemetryHandler } = await import('../../api/client-telemetry.js');
    const log = vi.fn(), handler = createTelemetryHandler({ log });
    const response = createResponse();
    handler({ method: 'POST', body: 'x'.repeat(16 * 1024 + 1) }, response);
    expect(response.statusCode).toBe(413);
    handler({ method: 'POST', body: '{' }, response); expect(response.statusCode).toBe(400);
    expect(log).not.toHaveBeenCalled();
  });
  it('deduplicates and samples logs, excludes untrusted content and expires dedupe', async () => {
    const { createTelemetryHandler } = await import('../../api/client-telemetry.js');
    let time = 1;
    const log = vi.fn(), handler = createTelemetryHandler({ log, now: () => time });
    for (let i = 0; i < 20; i++) handler({ method: 'POST', body: { ...valid, error: 'synthetic-secret', extras: { url: 'synthetic-private-url' } } }, createResponse());
    expect(log).toHaveBeenCalledOnce();
    expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic-secret');
    expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic-private-url');
    time = 60_001;
    handler({ method: 'POST', body: valid }, createResponse());
    expect(log).toHaveBeenCalledTimes(2);
  });
  it('rate limits caller and process and resumes after the window', async () => {
    const { createTelemetryHandler } = await import('../../api/client-telemetry.js');
    let time = 0;
    const handler = createTelemetryHandler({ log: vi.fn(), now: () => time });
    const req = { method: 'POST', body: valid, socket: { remoteAddress: '192.0.2.1' } };
    for (let i = 0; i < 30; i++) handler(req, createResponse());
    const blocked = createResponse(); handler(req, blocked);
    expect(blocked.statusCode).toBe(429);
    for (let caller = 2; caller <= 4; caller++) {
      for (let i = 0; i < 30; i++) handler({ ...req, socket: { remoteAddress: `192.0.2.${caller}` } }, createResponse());
    }
    const globalBlocked = createResponse(); handler({ ...req, socket: { remoteAddress: '192.0.2.5' } }, globalBlocked);
    expect(globalBlocked.statusCode).toBe(429);
    time = 60_000;
    const resumed = createResponse(); handler(req, resumed); expect(resumed.statusCode).toBe(200);
  });
});
