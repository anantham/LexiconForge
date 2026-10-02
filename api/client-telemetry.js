import admission from '../services/scraping/requestBudget.cjs';

const MAX_BODY_SIZE_BYTES = 16 * 1024;
const EVENTS = new Set(['known_limit_reached', 'translation_failed', 'translation_started', 'translation_completed', 'translation_aborted', 'client_uncaught_error', 'client_unhandled_rejection', 'ui_error_rendered']);
const FAILURES = new Set(['trial_limit', 'missing_api_key', 'timeout', 'provider_malformed_response', 'uncaught_exception', 'unhandled_rejection', 'unknown']);
const SURFACES = new Set(['auto_visit', 'auto_preload', 'manual_translate', 'ui_render', 'global']);

export function createTelemetryHandler({ now = Date.now, log = console.log } = {}) {
  const callerBudget = admission.createRequestBudget({ perMinute: 30, now });
  const processBudget = admission.createRequestBudget({ perMinute: 120, now });
  const seen = new Map();
  let sample = 0;
  return function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
    }
    const releaseCaller = callerBudget.acquire(req);
    const releaseProcess = releaseCaller && processBudget.acquire({});
    if (!releaseCaller || !releaseProcess) {
      releaseCaller?.();
      res.setHeader('Retry-After', '60');
      return res.status(429).json({ ok: false, error: 'Telemetry request budget exceeded.' });
    }
    releaseCaller(); releaseProcess();
    let body, bytes;
    try {
      bytes = Buffer.byteLength(typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? null), 'utf8');
      if (bytes > MAX_BODY_SIZE_BYTES) {
        return res.status(413).json({ ok: false, error: `Payload too large. Max size is ${MAX_BODY_SIZE_BYTES} bytes.` });
      }
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
      return res.status(400).json({ ok: false, error: 'Invalid JSON payload.' });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ ok: false, error: 'Invalid JSON payload.' });
    }
    if (typeof body.event_type !== 'string' || !body.event_type.trim()) {
      return res.status(400).json({ ok: false, error: 'Missing required field: event_type.' });
    }
    if (!EVENTS.has(body.event_type) ||
        (body.failure_type != null && !FAILURES.has(body.failure_type)) ||
        (body.surface != null && !SURFACES.has(body.surface)) ||
        (body.expected != null && typeof body.expected !== 'boolean') ||
        (body.user_visible != null && typeof body.user_visible !== 'boolean')) {
      return res.status(400).json({ ok: false, error: 'Invalid telemetry field.' });
    }
    const fields = {
      event_type: body.event_type,
      failure_type: body.failure_type ?? null,
      surface: body.surface ?? null,
      expected: body.expected ?? null,
      user_visible: body.user_visible ?? null,
    };
    const time = now();
    for (const [key, expires] of seen) if (time >= expires) seen.delete(key);
    // Never log caller-provided messages, URLs, IDs, stacks, models or extras.
    // At most one identical field tuple/minute, one in ten admitted events, and
    // a fixed registry cap. Admission above bounds total work per process.
    const key = JSON.stringify(fields);
    if (sample++ % 10 === 0 && !seen.has(key) && seen.size < 256) {
      seen.set(key, time + 60_000);
      log('[ClientTelemetryPOC]', { ...fields, received_at: new Date(time).toISOString() });
    }
    return res.status(200).json({ ok: true, receivedAt: new Date(time).toISOString() });
  };
}

export default createTelemetryHandler();
