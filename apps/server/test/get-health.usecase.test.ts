import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { GetHealthResponseSchema } from '../src/module/health/dto/get-health.dto';
import type { HealthRepository } from '../src/module/health/health.repository';
import { GetHealthUsecase } from '../src/module/health/usecase/get-health.usecase';

const repo = (pingDatabase: () => Promise<void>) => ({ pingDatabase }) as unknown as HealthRepository;

describe('GetHealthUsecase', () => {
  it('reports the database as up', async () => {
    const result = await new GetHealthUsecase(repo(vi.fn().mockResolvedValue(undefined))).execute();
    expect(result).toEqual({ ok: true, database: 'up' });
    expect(GetHealthResponseSchema.safeParse(result).success).toBe(true);
  });

  it('turns a database failure into a 503', async () => {
    const usecase = new GetHealthUsecase(repo(vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))));
    await expect(usecase.execute()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
