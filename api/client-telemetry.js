const MAX_BODY_SIZE_BYTES = 16 * 1024;

function estimateBodySize(body) {
  if (body == null) {
    return 0;
  }

  if (typeof body === 'string') {
    return Buffer.byteLength(body, 'utf8');
  }

  return Buffer.byteLength(JSON.stringify(body), 'utf8');
}

function normalizeBody(body) {
  if (body == null) {
    return null;
  }

  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }

  if (typeof body === 'object') {
    return body;
  }

  return null;
}

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      ok: false,
      error: 'Method not allowed. Use POST.',
    });
  }

  const bodySize = estimateBodySize(req.body);
  if (bodySize > MAX_BODY_SIZE_BYTES) {
    return res.status(413).json({
      ok: false,
      error: `Payload too large. Max size is ${MAX_BODY_SIZE_BYTES} bytes.`,
    });
  }

  const body = normalizeBody(req.body);
  if (!body || typeof body !== 'object') {
    return res.status(400).json({
      ok: false,
      error: 'Invalid JSON payload.',
    });
  }

  if (typeof body.event_type !== 'string' || body.event_type.trim().length === 0) {
    return res.status(400).json({
      ok: false,
      error: 'Missing required field: event_type.',
    });
  }

  console.log('[ClientTelemetryPOC]', {
    event_type: body.event_type,
    failure_type: typeof body.failure_type === 'string' ? body.failure_type : null,
    surface: typeof body.surface === 'string' ? body.surface : null,
    expected: typeof body.expected === 'boolean' ? body.expected : null,
    user_visible: typeof body.user_visible === 'boolean' ? body.user_visible : null,
    received_at: new Date().toISOString(),
  });

  return res.status(200).json({
    ok: true,
    receivedAt: new Date().toISOString(),
  });
}
