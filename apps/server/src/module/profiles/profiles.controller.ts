import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiConflictResponse, ApiNotFoundResponse, ApiOkResponse } from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import { GetProfileParamsDto, GetProfileResponseDto } from './dto/get-profile.dto';
import { RebuildProfileParamsDto, RebuildProfileResponseDto } from './dto/rebuild-profile.dto';
import {
  UpdateProfileNotesParamsDto,
  UpdateProfileNotesRequestDto,
  UpdateProfileNotesResponseDto,
} from './dto/update-profile-notes.dto';
import { GetProfileUsecase } from './usecase/get-profile.usecase';
import { RebuildProfileUsecase } from './usecase/rebuild-profile.usecase';
import { UpdateProfileNotesUsecase } from './usecase/update-profile-notes.usecase';

@Controller('repos/:repositoryId/profile')
export class ProfilesController {
  constructor(
    private readonly getProfileUsecase: GetProfileUsecase,
    private readonly updateProfileNotesUsecase: UpdateProfileNotesUsecase,
    private readonly rebuildProfileUsecase: RebuildProfileUsecase,
  ) {}

  @Get()
  @ZodSerializerDto(GetProfileResponseDto)
  @ApiOkResponse({ type: GetProfileResponseDto })
  @ApiNotFoundResponse({ description: 'No such repository, or it has no profile yet' })
  getProfile(@Param() params: GetProfileParamsDto) {
    return this.getProfileUsecase.execute(params);
  }

  @Put('notes')
  @ZodSerializerDto(UpdateProfileNotesResponseDto)
  @ApiOkResponse({ type: UpdateProfileNotesResponseDto })
  @ApiNotFoundResponse({ description: 'No such repository' })
  @ApiConflictResponse({ description: 'The repository has no profile yet' })
  updateProfileNotes(@Param() params: UpdateProfileNotesParamsDto, @Body() body: UpdateProfileNotesRequestDto) {
    return this.updateProfileNotesUsecase.execute(params, body);
  }

  // Builds the profile again from what the repository looks like now. The notes are kept.
  @Post('rebuild')
  @HttpCode(200)
  @ZodSerializerDto(RebuildProfileResponseDto)
  @ApiOkResponse({ type: RebuildProfileResponseDto })
  @ApiNotFoundResponse({ description: 'No such repository' })
  @ApiConflictResponse({ description: 'The profile is already being built' })
  rebuildProfile(@Param() params: RebuildProfileParamsDto) {
    return this.rebuildProfileUsecase.execute(params);
  }
}
