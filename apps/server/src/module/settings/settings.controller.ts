import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse } from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import type { AuthContext } from '../../infra/auth/auth-context';
import { CurrentAccountId } from '../../infra/decorator/current-account-id.decorator';
import { CurrentAuth } from '../../infra/decorator/current-auth.decorator';
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
  getSettings(@CurrentAuth() auth: AuthContext) {
    return this.getSettingsUsecase.execute(auth.accountId);
  }

  @Put('llm')
  @ZodSerializerDto(UpdateLlmSettingsResponseDto)
  @ApiOkResponse({ type: UpdateLlmSettingsResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid provider or model, or an API key is required' })
  updateLlmSettings(@CurrentAccountId() accountId: string, @Body() body: UpdateLlmSettingsRequestDto) {
    return this.updateLlmSettingsUsecase.execute(accountId, body);
  }

  @Post('llm/test')
  @HttpCode(200)
  @ZodSerializerDto(TestLlmSettingsResponseDto)
  @ApiOkResponse({ type: TestLlmSettingsResponseDto })
  @ApiBadRequestResponse({ description: 'No LLM settings saved yet' })
  testLlmSettings(@CurrentAccountId() accountId: string) {
    return this.testLlmSettingsUsecase.execute(accountId);
  }
}
