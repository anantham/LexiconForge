import { isSuttaFlowDebug } from './suttaStudioDebug';

export type PipelineLogLevel = 'info' | 'warn' | 'error';

export type PipelineLogEntry = {
  ts: string;
  level: PipelineLogLevel;
  stage?: string;
  phaseId?: string;
  message: string;
  data?: Record<string, unknown>;
};

const MAX_PIPELINE_LOGS = 2000;
let pipelineLogs: PipelineLogEntry[] = [];

export const resetPipelineLogs = (reason?: string, meta?: Record<string, unknown>) => {
  if (!isSuttaFlowDebug()) return;
  pipelineLogs = [];
  logPipelineEvent({
    level: 'info',
    stage: 'system',
    message: 'pipeline.reset',
    data: { reason, ...(meta || {}) },
  });
};

export const logPipelineEvent = (entry: Omit<PipelineLogEntry, 'ts'>) => {
  if (!isSuttaFlowDebug()) return;
  const fullEntry: PipelineLogEntry = {
    ...entry,
    ts: new Date().toISOString(),
  };
  pipelineLogs.push(fullEntry);
  if (pipelineLogs.length > MAX_PIPELINE_LOGS) {
    pipelineLogs.shift();
  }
  const label = `[SuttaStudioPipeline] ${entry.message}`;
  if (entry.level === 'error') {
    console.error(label, entry.data || {});
  } else if (entry.level === 'warn') {
    console.warn(label, entry.data || {});
  } else {
    console.log(label, entry.data || {});
  }
};

export const getPipelineLogs = (): PipelineLogEntry[] => pipelineLogs.slice();
