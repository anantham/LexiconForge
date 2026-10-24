import { describe, expect, it } from 'vitest';
import { getImageErrorDetails } from '../../services/imageErrors';

describe('getImageErrorDetails', () => {
  it.each([undefined, null, 'offline', 42, false])('accepts a non-Error rejection: %s', value => {
    expect(getImageErrorDetails(value)).toEqual({});
  });

  it('retains actionable metadata from a provider error without requiring a class', () => {
    const cause = new Error('network offline');
    const error = Object.assign(new Error('request failed', { cause }), {
      errorType: 'PIAPI_UNREACHABLE',
      retryable: true,
      canRetry: false,
      fallbackEligible: false,
      suggestedActions: ['Reconnect', 'Resume the existing task'],
    });
    expect(getImageErrorDetails(error)).toEqual({
      message: 'request failed', name: 'Error', cause,
      errorType: 'PIAPI_UNREACHABLE', retryable: true, canRetry: false,
      fallbackEligible: false, suggestedActions: ['Reconnect', 'Resume the existing task'],
    });
  });

  it('does not interpret malformed metadata as permission to retry or fallback', () => {
    expect(getImageErrorDetails({
      message: { text: 'failed' }, canRetry: 'true', retryable: 1,
      fallbackEligible: 'yes', suggestedActions: ['Reconnect', 5, null],
    })).toEqual({
      message: undefined, name: undefined, errorType: undefined,
      canRetry: undefined, retryable: undefined, fallbackEligible: undefined,
      suggestedActions: ['Reconnect'], cause: undefined,
    });
  });
});
