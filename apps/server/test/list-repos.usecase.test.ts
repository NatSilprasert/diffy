import { describe, expect, it, vi } from 'vitest';
import { ListReposResponseSchema } from '../src/module/repos/dto/list-repos.dto';
import type { ReposRepository } from '../src/module/repos/repos.repository';
import { ListReposUsecase } from '../src/module/repos/usecase/list-repos.usecase';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  owner: 'acme',
  name: 'api',
  enabled: true,
  createdAt: new Date('2026-10-24T01:02:03.000Z'),
  ...over,
});

const run = (rows: unknown[]) =>
  new ListReposUsecase({ findAll: vi.fn().mockResolvedValue(rows) } as unknown as ReposRepository).execute();

describe('ListReposUsecase', () => {
  it('returns an empty list when nothing is watched', async () => {
    expect(await run([])).toEqual({ repos: [] });
  });

  it('formats the date as an ISO string and builds fullName', async () => {
    const result = await run([
      row({ enabled: false }),
    ]);
    expect(result.repos[0]).toMatchObject({
      fullName: 'acme/api',
      enabled: false,
      createdAt: '2026-10-24T01:02:03.000Z',
    });
    expect(ListReposResponseSchema.safeParse(result).success).toBe(true);
  });
});
