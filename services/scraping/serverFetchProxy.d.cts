import type { IncomingMessage, ServerResponse } from 'node:http';
export const LIMITS: Readonly<{ maxBytes: number; deadlineMs: number; maxRedirects: number; maxUrlLength: number }>;
export function createFetchProxy(options?: { source?: string }): (req: IncomingMessage, res: ServerResponse, targetUrl: string | null | undefined) => Promise<void>;
