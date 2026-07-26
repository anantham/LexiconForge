import appConfig from '../../config/app.json';

/**
 * Clamp a request parameter to the limits in config/app.json.
 *
 * Honest contract: a value that cannot be parsed as a number returns
 * `undefined` (the parameter is OMITTED from the request) rather than being
 * passed through to the API — a "validator" whose failure mode is
 * pass-through is a no-op wearing a safety name. Params without a limits
 * entry pass through unchanged (no opinion, disclosed here).
 */
export const validateAndClampParameter = (value: any, paramName: string): any => {
  if (value === undefined || value === null) return value;

  const limits = appConfig.aiParameters.limits[paramName as keyof typeof appConfig.aiParameters.limits];
  if (!limits) return value;

  const numValue = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(numValue)) {
    console.warn(`[Parameter Validation] ${paramName}=${JSON.stringify(value)} is not numeric — omitting it from the request`);
    return undefined;
  }

  const clamped = Math.max(limits.min, Math.min(limits.max, numValue));
  if (clamped !== numValue) {
    console.warn(`[Parameter Validation] Clamped ${paramName} from ${numValue} to ${clamped} (limits: ${limits.min}-${limits.max})`);
  }

  return clamped;
};
