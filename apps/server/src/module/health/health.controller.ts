import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import { Public } from '../../infra/decorator/public.decorator';
import { GetHealthResponseDto } from './dto/get-health.dto';
import { GetHealthUsecase } from './usecase/get-health.usecase';

@Controller('health')
export class HealthController {
  constructor(private readonly getHealthUsecase: GetHealthUsecase) {}

  @Public()
  @Get()
  @ZodSerializerDto(GetHealthResponseDto)
  @ApiOkResponse({ type: GetHealthResponseDto })
  getHealth() {
    return this.getHealthUsecase.execute();
  }
}
