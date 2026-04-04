/**
 * AI debug logging — delegates to the centralized utils/debug.ts pipeline system.
 *
 * Legacy callers use aiDebugEnabled/dlog/dlogFull; these now route through
 * the 'api' pipeline with appropriate level checks.
 */
import { debugPipelineEnabled } from '../../utils/debug';

export const aiDebugEnabled = (): boolean =>
  debugPipelineEnabled('api', 'summary');

export const aiDebugFullEnabled = (): boolean =>
  debugPipelineEnabled('api', 'full');

export const dlog = (...args: any[]) => {
  if (aiDebugEnabled()) console.log(...args);
};

export const dlogFull = (...args: any[]) => {
  if (aiDebugFullEnabled()) console.log(...args);
};
