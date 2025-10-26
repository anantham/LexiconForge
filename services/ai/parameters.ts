import appConfig from '../../config/app.json';

export const validateAndClampParameter = (value: any, paramName: string): any => {
  if (value === undefined || value === null) return value;

  const limits = appConfig.aiParameters.limits[paramName as keyof typeof appConfig.aiParameters.limits];
  if (!limits) return value;

  const numValue = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(numValue)) return value;

  const clamped = Math.max(limits.min, Math.min(limits.max, numValue));
  if (clamped !== numValue) {
    console.warn(`[Parameter Validation] Clamped ${paramName} from ${numValue} to ${clamped} (limits: ${limits.min}-${limits.max})`);
  }

  return clamped;
};
