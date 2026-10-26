import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiConflictResponse, ApiNotFoundResponse, ApiOkResponse } from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import { GetProfileParamsDto, GetProfileResponseDto } from './dto/get-profile.dto';
import { ListProfilesResponseDto } from './dto/list-profiles.dto';
import { RebuildProfileParamsDto, RebuildProfileResponseDto } from './dto/rebuild-profile.dto';
import {
  UpdateProfileNotesParamsDto,
  UpdateProfileNotesRequestDto,
  UpdateProfileNotesResponseDto,
} from './dto/update-profile-notes.dto';
import { GetProfileUsecase } from './usecase/get-profile.usecase';
import { ListProfilesUsecase } from './usecase/list-profiles.usecase';
import { RebuildProfileUsecase } from './usecase/rebuild-profile.usecase';
import { UpdateProfileNotesUsecase } from './usecase/update-profile-notes.usecase';

// The profile of a repository lives under the repository's address (/repos/:id/profile). The list of every
// profile status is /repos/profiles, declared first so that "profiles" is never read as a repository id.
@Controller('repos')
export class ProfilesController {
  constructor(
    private readonly listProfilesUsecase: ListProfilesUsecase,
    private readonly getProfileUsecase: GetProfileUsecase,
    private readonly updateProfileNotesUsecase: UpdateProfileNotesUsecase,
    private readonly rebuildProfileUsecase: RebuildProfileUsecase,
  ) {}

  @Get('profiles')
  @ZodSerializerDto(ListProfilesResponseDto)
  @ApiOkResponse({ type: ListProfilesResponseDto })
  listProfiles() {
    return this.listProfilesUsecase.execute();
  }

  @Get(':repositoryId/profile')
  @ZodSerializerDto(GetProfileResponseDto)
  @ApiOkResponse({ type: GetProfileResponseDto })
  @ApiNotFoundResponse({ description: 'No such repository, or it has no profile yet' })
  getProfile(@Param() params: GetProfileParamsDto) {
    return this.getProfileUsecase.execute(params);
  }

  @Put(':repositoryId/profile/notes')
  @ZodSerializerDto(UpdateProfileNotesResponseDto)
  @ApiOkResponse({ type: UpdateProfileNotesResponseDto })
  @ApiNotFoundResponse({ description: 'No such repository' })
  @ApiConflictResponse({ description: 'The repository has no profile yet' })
  updateProfileNotes(@Param() params: UpdateProfileNotesParamsDto, @Body() body: UpdateProfileNotesRequestDto) {
    return this.updateProfileNotesUsecase.execute(params, body);
  }

  // Builds the profile again from what the repository looks like now. The notes are kept.
  @Post(':repositoryId/profile/rebuild')
  @HttpCode(200)
  @ZodSerializerDto(RebuildProfileResponseDto)
  @ApiOkResponse({ type: RebuildProfileResponseDto })
  @ApiNotFoundResponse({ description: 'No such repository' })
  @ApiConflictResponse({ description: 'The profile is already being built' })
  rebuildProfile(@Param() params: RebuildProfileParamsDto) {
    return this.rebuildProfileUsecase.execute(params);
  }
}
