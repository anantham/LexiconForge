import { IMPORT_LIMITS, ImportValidationError, SessionJsonValidator, type ImportLimits } from './sessionValidation';

/** Stage and validate a remote session before allowing any persistent writes. */
export async function downloadSession(
  url: string,
  onDownload?: (loaded: number, total: number) => void,
  onChapter?: (chapter: Record<string, any>) => void,
  limits: Pick<ImportLimits, 'bytes' | 'downloadMs' | 'chunks'> = IMPORT_LIMITS,
): Promise<{ chunks: Uint8Array[]; validation: SessionJsonValidator }> {
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const deadlineAt = Date.now() + limits.downloadMs;
  let rejectDeadline!: (reason: Error) => void;
  const deadline = new Promise<never>((_, reject) => { rejectDeadline = reject; });
  const timer = setTimeout(() => {
    rejectDeadline(new ImportValidationError('download exceeded its absolute deadline'));
    controller.abort();
    void reader?.cancel().catch(() => {});
  }, limits.downloadMs);
  try {
    const response = await Promise.race([fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } }), deadline]);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    reader = response.body?.getReader();
    if (!reader) throw new Error('Response body is not readable');
    const advertised = response.headers?.get('content-length');
    const total = advertised && /^\d+$/.test(advertised) ? Number(advertised) : 0;
    if (total > limits.bytes) throw new ImportValidationError('file too large (>500MB)');
    const chunks: Uint8Array[] = [];
    const validation = new SessionJsonValidator(onChapter);
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const decode = (bytes?: Uint8Array, stream = false): string => {
      try { return decoder.decode(bytes, { stream }); }
      catch { throw new ImportValidationError('body is not valid UTF-8'); }
    };
    let received = 0;
    let prefix = '';
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (Date.now() >= deadlineAt) throw new ImportValidationError('download exceeded its absolute deadline');
      if (done) break;
      received += value.byteLength;
      if (received > limits.bytes) throw new ImportValidationError('received body too large (>500MB)');
      if (chunks.length >= limits.chunks) throw new ImportValidationError('too many download chunks');
      // Bound synchronous parser work, even if a response provides one huge chunk.
      for (let offset = 0; offset < value.byteLength; offset += 64 * 1024) {
        if (Date.now() >= deadlineAt) throw new ImportValidationError('download exceeded its absolute deadline');
        const text = decode(value.subarray(offset, offset + 64 * 1024), true);
        prefix = (prefix + text).slice(0, 256);
        if (prefix.trimStart().startsWith('version https://git-lfs.github.com/spec/v1')) {
          throw new ImportValidationError('Session URL returned a Git LFS pointer instead of JSON. Use the GitHub media URL.');
        }
        validation.feed(text);
      }
      chunks.push(value.slice());
      onDownload?.(received, Number.isFinite(total) ? total : 0);
    }
    validation.feed(decode());
    validation.finish();
    return { chunks, validation };
  } catch (error) {
    controller.abort();
    void reader?.cancel().catch(() => {});
    throw error;
  } finally {
    clearTimeout(timer);
    try { reader?.releaseLock(); } catch { /* A cancelled pending read can still hold the lock. */ }
  }
}
