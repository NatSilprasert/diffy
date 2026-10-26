import type { Octokit } from 'octokit';
import { describe, expect, it, vi } from 'vitest';
import { loadFailedChecks, MAX_ANNOTATIONS_PER_CHECK, MAX_CHECK_SUMMARY_CHARS, MAX_FAILED_CHECKS } from '../src/ci-checks.js';
import type { PullRequestInfo } from '../src/github.js';

const pr = { owner: 'acme', repo: 'api', number: 7, headSha: 'abc123' } as PullRequestInfo;

const run = (id: number, name: string, conclusion: string | null, output: { title?: string; summary?: string } = {}) => ({ id, name, conclusion, output });

function octokitWith(runs: unknown[], listAnnotations = vi.fn().mockResolvedValue({ data: [] })) {
  const listForRef = vi.fn().mockResolvedValue({ data: { check_runs: runs } });
  return { octokit: { rest: { checks: { listForRef, listAnnotations } } } as unknown as Octokit, listForRef, listAnnotations };
}

describe('loadFailedChecks', () => {
  it('reads the checks of the commit under review and keeps only the ones that failed', async () => {
    const { octokit, listForRef } = octokitWith([
      run(1, 'lint', 'failure', { title: '2 errors', summary: 'ESLint found problems' }),
      run(2, 'build', 'success'),
      run(3, 'e2e', null),
      run(4, 'unit', 'timed_out'),
      run(5, 'docs', 'cancelled'),
    ]);
    const checks = await loadFailedChecks(octokit, pr);

    expect(listForRef).toHaveBeenCalledWith({ owner: 'acme', repo: 'api', ref: 'abc123', per_page: 100 });
    expect(checks.map((c) => c.name)).toEqual(['lint', 'unit']);
    expect(checks[0]!.summary).toBe('2 errors - ESLint found problems');
  });

  it('adds where each check pointed in the code', async () => {
    const listAnnotations = vi.fn().mockResolvedValue({ data: [{ path: 'src/a.ts', start_line: 12, message: 'Unexpected\n  any', title: 'x' }] });
    const { octokit } = octokitWith([run(1, 'lint', 'failure')], listAnnotations);

    const [check] = await loadFailedChecks(octokit, pr);

    expect(listAnnotations).toHaveBeenCalledWith({ owner: 'acme', repo: 'api', check_run_id: 1, per_page: MAX_ANNOTATIONS_PER_CHECK });
    expect(check!.annotations).toEqual(['src/a.ts:12: Unexpected any']);
  });

  it('keeps going without annotations when they cannot be read, and cuts a long summary', async () => {
    const { octokit } = octokitWith([run(1, 'lint', 'failure', { summary: 'x'.repeat(MAX_CHECK_SUMMARY_CHARS + 50) })], vi.fn().mockRejectedValue(new Error('403')));
    const [check] = await loadFailedChecks(octokit, pr);
    expect(check!.annotations).toEqual([]);
    expect(check!.summary).toHaveLength(MAX_CHECK_SUMMARY_CHARS + 3);
  });

  it('looks at only the first few failed checks', async () => {
    const { octokit, listAnnotations } = octokitWith(Array.from({ length: 6 }, (_, i) => run(i, `c${i}`, 'failure')));
    expect(await loadFailedChecks(octokit, pr)).toHaveLength(MAX_FAILED_CHECKS);
    expect(listAnnotations).toHaveBeenCalledTimes(MAX_FAILED_CHECKS);
  });

  it('gives nothing, not an error, when GitHub refuses (no permission to read checks)', async () => {
    const octokit = { rest: { checks: { listForRef: vi.fn().mockRejectedValue(Object.assign(new Error('Resource not accessible'), { status: 403 })) } } } as unknown as Octokit;
    expect(await loadFailedChecks(octokit, pr)).toEqual([]);
  });
});
