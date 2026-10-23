import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse } from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import { GetSettingsResponseDto } from './dto/get-settings.dto';
import {
  UpdateGithubSettingsRequestDto,
  UpdateGithubSettingsResponseDto,
} from './dto/update-github-settings.dto';
import { GetSettingsUsecase } from './usecase/get-settings.usecase';
import { UpdateGithubSettingsUsecase } from './usecase/update-github-settings.usecase';

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly getSettingsUsecase: GetSettingsUsecase,
    private readonly updateGithubSettingsUsecase: UpdateGithubSettingsUsecase,
  ) {}

  @Get()
  @ZodSerializerDto(GetSettingsResponseDto)
  @ApiOkResponse({ type: GetSettingsResponseDto })
  getSettings() {
    return this.getSettingsUsecase.execute();
  }

  @Put('github')
  @ZodSerializerDto(UpdateGithubSettingsResponseDto)
  @ApiOkResponse({ type: UpdateGithubSettingsResponseDto })
  @ApiBadRequestResponse({ description: 'Missing token, or GitHub rejected it' })
  updateGithubSettings(@Body() body: UpdateGithubSettingsRequestDto) {
    return this.updateGithubSettingsUsecase.execute(body);
  }
}
