import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HealthRepository } from '../health.repository';
import type { GetHealthResponseDto } from '../dto/get-health.dto';

@Injectable()
export class GetHealthUsecase {
  constructor(private readonly healthRepository: HealthRepository) {}

  async execute(): Promise<GetHealthResponseDto> {
    try {
      await this.healthRepository.pingDatabase();
    } catch {
      throw new ServiceUnavailableException('Database is unreachable');
    }
    return { ok: true, database: 'up' };
  }
}
