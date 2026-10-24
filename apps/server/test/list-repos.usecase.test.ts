import { describe, expect, it, vi } from 'vitest';
import { ListReposResponseSchema } from '../src/module/repos/dto/list-repos.dto';
import type { ReposRepository } from '../src/module/repos/repos.repository';
import { ListReposUsecase } from '../src/module/repos/usecase/list-repos.usecase';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  owner: 'acme',
  name: 'api',
  enabled: true,
  lastPolledAt: null,
  lastError: null,
  createdAt: new Date('2026-10-24T01:02:03.000Z'),
  ...over,
});

const run = (rows: unknown[]) =>
  new ListReposUsecase({ findAll: vi.fn().mockResolvedValue(rows) } as unknown as ReposRepository).execute();

describe('ListReposUsecase', () => {
  it('returns an empty list when nothing is watched', async () => {
    expect(await run([])).toEqual({ repos: [] });
  });

  it('formats dates as ISO strings and builds fullName', async () => {
    const result = await run([
      row({ lastPolledAt: new Date('2026-10-24T02:00:00.000Z'), lastError: 'Bad credentials', enabled: false }),
    ]);
    expect(result.repos[0]).toMatchObject({
      fullName: 'acme/api',
      enabled: false,
      lastPolledAt: '2026-10-24T02:00:00.000Z',
      lastError: 'Bad credentials',
      createdAt: '2026-10-24T01:02:03.000Z',
    });
    expect(ListReposResponseSchema.safeParse(result).success).toBe(true);
  });
});
