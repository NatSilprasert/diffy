import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse } from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import { GetSettingsResponseDto } from './dto/get-settings.dto';
import { TestLlmSettingsResponseDto } from './dto/test-llm-settings.dto';
import {
  UpdateLlmSettingsRequestDto,
  UpdateLlmSettingsResponseDto,
} from './dto/update-llm-settings.dto';
import { GetSettingsUsecase } from './usecase/get-settings.usecase';
import { TestLlmSettingsUsecase } from './usecase/test-llm-settings.usecase';
import { UpdateLlmSettingsUsecase } from './usecase/update-llm-settings.usecase';

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly getSettingsUsecase: GetSettingsUsecase,
    private readonly updateLlmSettingsUsecase: UpdateLlmSettingsUsecase,
    private readonly testLlmSettingsUsecase: TestLlmSettingsUsecase,
  ) {}

  @Get()
  @ZodSerializerDto(GetSettingsResponseDto)
  @ApiOkResponse({ type: GetSettingsResponseDto })
  getSettings() {
    return this.getSettingsUsecase.execute();
  }

  @Put('llm')
  @ZodSerializerDto(UpdateLlmSettingsResponseDto)
  @ApiOkResponse({ type: UpdateLlmSettingsResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid provider or model, or an API key is required' })
  updateLlmSettings(@Body() body: UpdateLlmSettingsRequestDto) {
    return this.updateLlmSettingsUsecase.execute(body);
  }

  @Post('llm/test')
  @HttpCode(200)
  @ZodSerializerDto(TestLlmSettingsResponseDto)
  @ApiOkResponse({ type: TestLlmSettingsResponseDto })
  @ApiBadRequestResponse({ description: 'No LLM settings saved yet' })
  testLlmSettings() {
    return this.testLlmSettingsUsecase.execute();
  }
}
