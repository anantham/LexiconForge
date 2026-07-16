import fs from 'fs/promises';
import path from 'path';

export type BenchmarkRunStatus = 'running' | 'complete' | 'error';

const VALID_STATUSES = new Set<BenchmarkRunStatus>(['running', 'complete', 'error']);

export async function readBenchmarkRunStatus(
  runDir: string,
): Promise<BenchmarkRunStatus | null> {
  const progressPath = path.join(runDir, 'progress.json');
  let raw: string;
  try {
    raw = await fs.readFile(progressPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
    throw new Error(
      `[BenchmarkStatus] Failed to read ${progressPath}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`[BenchmarkStatus] Invalid JSON in ${progressPath}; refusing to publish this run.`, {
      cause: error,
    });
  }

  const status = (parsed as { status?: unknown })?.status;
  if (typeof status !== 'string' || !VALID_STATUSES.has(status as BenchmarkRunStatus)) {
    throw new Error(
      `[BenchmarkStatus] ${progressPath} has invalid status ${JSON.stringify(status)}; expected running, complete, or error.`,
    );
  }
  return status as BenchmarkRunStatus;
}

export async function assertBenchmarkRunComplete(
  runDir: string,
  consumer: string,
): Promise<void> {
  const status = await readBenchmarkRunStatus(runDir);
  if (status !== 'complete') {
    throw new Error(
      `[${consumer}] Refusing benchmark run ${path.basename(runDir)}: status is ${status ?? 'missing'}; expected complete.`,
    );
  }
}
