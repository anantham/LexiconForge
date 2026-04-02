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
          surface: 'auto_translate',
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
