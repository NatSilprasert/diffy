import type { Octokit } from 'octokit';
import { describe, expect, it, vi } from 'vitest';
import type { PullRequestInfo } from '../src/github.js';
import { loadLinkedIssues, MAX_ISSUE_BODY_CHARS, MAX_LINKED_ISSUES, parseLinkedIssues } from '../src/linked-issues.js';

const pr = { owner: 'acme', repo: 'api', number: 7 };

describe('parseLinkedIssues', () => {
  it.each(['Closes #12', 'closes #12', 'Fixes: #12', 'resolved #12', 'This fixes #12.', 'Closed  #12'])('reads %s', (text) =>
    expect(parseLinkedIssues(text, pr)).toEqual([12]),
  );

  it('reads the same repository written out, and the URL of the issue', () => {
    expect(parseLinkedIssues('Fixes acme/api#3 and closes https://github.com/Acme/API/issues/4', pr)).toEqual([3, 4]);
  });

  it('leaves out other repositories, the pull request itself and repeats', () => {
    expect(parseLinkedIssues('Closes other/repo#5, fixes #7, closes #9, fixes #9', pr)).toEqual([9]);
    expect(parseLinkedIssues('Closes https://github.com/other/repo/issues/5', pr)).toEqual([]);
  });

  it('ignores a mention that does not close anything', () => {
    expect(parseLinkedIssues('Related to #12. See #13. prefixes #14', pr)).toEqual([]);
  });

  it('keeps the first few', () => {
    const body = Array.from({ length: 6 }, (_, i) => `Closes #${i + 10}`).join('\n');
    expect(parseLinkedIssues(body, pr)).toEqual([10, 11, 12].slice(0, MAX_LINKED_ISSUES));
  });
});

describe('loadLinkedIssues', () => {
  const info = (body: string) => ({ ...pr, body }) as PullRequestInfo;
  const octokitWith = (get: ReturnType<typeof vi.fn>) => ({ rest: { issues: { get } } }) as unknown as Octokit;

  it('reads each issue, cutting a long description', async () => {
    const get = vi.fn().mockResolvedValue({ data: { title: 'Login fails', body: 'x'.repeat(MAX_ISSUE_BODY_CHARS + 5) } });
    const [issue] = await loadLinkedIssues(octokitWith(get), info('Closes #12'));

    expect(get).toHaveBeenCalledWith({ owner: 'acme', repo: 'api', issue_number: 12 });
    expect(issue).toMatchObject({ number: 12, title: 'Login fails', truncated: true });
    expect(issue!.body).toHaveLength(MAX_ISSUE_BODY_CHARS);
  });

  it('leaves out an issue that cannot be read and a number that is a pull request', async () => {
    const get = vi.fn(async ({ issue_number }: { issue_number: number }) => {
      if (issue_number === 1) throw Object.assign(new Error('Not Found'), { status: 404 });
      if (issue_number === 2) return { data: { title: 'A PR', body: '', pull_request: {} } };
      return { data: { title: 'Real', body: null } };
    });
    const issues = await loadLinkedIssues(octokitWith(get), info('Closes #1, closes #2, closes #3'));
    expect(issues).toEqual([{ number: 3, title: 'Real', body: '', truncated: false }]);
  });

  it('makes no call when the pull request closes nothing', async () => {
    const get = vi.fn();
    expect(await loadLinkedIssues(octokitWith(get), info('Just a change'))).toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });
});
