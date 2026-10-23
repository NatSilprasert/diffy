import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import { GetSettingsResponseDto } from './dto/get-settings.dto';
import { GetSettingsUsecase } from './usecase/get-settings.usecase';

@Controller('settings')
export class SettingsController {
  constructor(private readonly getSettingsUsecase: GetSettingsUsecase) {}

  @Get()
  @ZodSerializerDto(GetSettingsResponseDto)
  @ApiOkResponse({ type: GetSettingsResponseDto })
  getSettings() {
    return this.getSettingsUsecase.execute();
  }
}
