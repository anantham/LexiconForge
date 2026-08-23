/**
 * Test intent:
 * - Exercise the public resumable-job client against real response shapes.
 * - Keep status transitions observable while never logging prompt content.
 * - Distinguish terminal broker failures, broker restarts, and client timeouts.
 */
import { describe, expect, it, vi } from 'vitest';

import { BrokerJobError, createBrokerClient } from './broker-client.js';

const response = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
});

describe('createBrokerClient', () => {
    it('submits a named workflow, reports states, and resolves an absolute artifact URL', async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(response(202, { job_id: 'job-1', status: 'queued' }))
            .mockResolvedValueOnce(response(200, { job_id: 'job-1', status: 'running' }))
            .mockResolvedValueOnce(response(200, {
                job_id: 'job-1',
                status: 'completed',
                prompt_id: 'prompt-9',
                timing_ms: 1234,
                images: ['/api/comfyui/view?filename=scene.png&type=output'],
            }));
        const states = [];
        const client = createBrokerClient({
            baseUrl: 'https://broker.example.test/',
            fetchImpl,
            sleep: vi.fn().mockResolvedValue(undefined),
        });

        const result = await client.run({
            workflowName: 'gen_anime',
            prompt: 'visual prompt',
            negativePrompt: 'bad anatomy',
            pollIntervalMs: 1,
            timeoutMs: 1000,
            onState: (state) => states.push(state.status),
        });

        expect(fetchImpl).toHaveBeenNthCalledWith(1, 'https://broker.example.test/api/comfyui/jobs', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
                workflow_name: 'gen_anime',
                prompt: 'visual prompt',
                negative_prompt: 'bad anatomy',
                timeout_seconds: 1800,
                gpu_wait_timeout_seconds: 300,
            }),
        }));
        expect(states).toEqual(['queued', 'running', 'completed']);
        expect(result.imageUrl).toBe('https://broker.example.test/api/comfyui/view?filename=scene.png&type=output');
        expect(result.promptId).toBe('prompt-9');
    });

    it('surfaces the broker structured error without leaking the submitted prompt', async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(response(202, { job_id: 'job-2', status: 'queued' }))
            .mockResolvedValueOnce(response(200, {
                job_id: 'job-2',
                status: 'failed',
                error: { code: 'COMFYUI_GPU_BUSY', detail: 'GPU is reserved', retryable: true },
            }));
        const client = createBrokerClient({
            baseUrl: 'https://broker.example.test',
            fetchImpl,
            sleep: vi.fn().mockResolvedValue(undefined),
        });

        const failure = await client.run({
            workflowName: 'gen_anime',
            prompt: 'private scene text',
            pollIntervalMs: 1,
            timeoutMs: 1000,
        }).catch((error) => error);

        expect(failure).toBeInstanceOf(BrokerJobError);
        expect(failure.code).toBe('COMFYUI_GPU_BUSY');
        expect(failure.retryable).toBe(true);
        expect(failure.message).not.toContain('private scene text');
    });

    it('distinguishes a broker restart from an ordinary HTTP failure', async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(response(202, { job_id: 'job-3', status: 'queued' }))
            .mockResolvedValueOnce(response(404, {
                code: 'COMFYUI_JOB_NOT_FOUND',
                detail: 'broker may have restarted',
                retryable: false,
            }));
        const client = createBrokerClient({
            baseUrl: 'https://broker.example.test',
            fetchImpl,
            sleep: vi.fn().mockResolvedValue(undefined),
        });

        await expect(client.run({
            workflowName: 'gen_anime',
            prompt: 'scene',
            pollIntervalMs: 1,
            timeoutMs: 1000,
        })).rejects.toMatchObject({ code: 'COMFYUI_JOB_NOT_FOUND', retryable: false });
    });

    it('rejects unsafe broker URLs before issuing a request', () => {
        expect(() => createBrokerClient({ baseUrl: 'javascript:alert(1)', fetchImpl: vi.fn() }))
            .toThrow('HTTP(S)');
        expect(() => createBrokerClient({ baseUrl: 'https://user:pass@example.test', fetchImpl: vi.fn() }))
            .toThrow('credentials');
    });
});
