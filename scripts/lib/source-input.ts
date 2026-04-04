import * as path from 'path';

const URL_OR_ADAPTER_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

export const isAdapterSpec = (input: string): boolean => URL_OR_ADAPTER_SCHEME.test(input);

export const normalizeSourceInput = (input: string): string => (
  isAdapterSpec(input) ? input : path.resolve(input)
);
