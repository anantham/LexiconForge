// Per-process admission. Fleet-wide quotas belong at the deployment edge.
const { isIP } = require('node:net');

function callerKey(req) {
  const forwarded = process.env.VERCEL === '1' && req.headers?.['x-vercel-forwarded-for'];
  const address = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress;
  return typeof address === 'string' && isIP(address) ? address : 'unknown';
}

function createRequestBudget({ maxActive = 8, maxCallerActive = 2, perMinute = 30, maxCallers = 2048, now = Date.now } = {}) {
  const callers = new Map();
  let active = 0;
  return {
    acquire(req) {
      const time = now();
      for (const [key, entry] of callers) {
        if (entry.active === 0 && time >= entry.expires) callers.delete(key);
      }
      const key = callerKey(req);
      let entry = callers.get(key);
      if (!entry) {
        if (callers.size >= maxCallers) return null;
        entry = { count: 0, active: 0, expires: time + 60_000 };
        callers.set(key, entry);
      }
      if (time >= entry.expires) { entry.count = 0; entry.expires = time + 60_000; }
      if (active >= maxActive || entry.active >= maxCallerActive || entry.count >= perMinute) return null;
      active++; entry.active++; entry.count++;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        active--; entry.active--;
      };
    },
  };
}

module.exports = { createRequestBudget };
