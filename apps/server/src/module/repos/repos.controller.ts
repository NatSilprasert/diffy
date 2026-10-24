import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import { AddRepoRequestDto, AddRepoResponseDto } from './dto/add-repo.dto';
import { ListAvailableReposQueryDto, ListAvailableReposResponseDto } from './dto/list-available-repos.dto';
import { ListReposResponseDto } from './dto/list-repos.dto';
import { RemoveRepoParamsDto } from './dto/remove-repo.dto';
import { UpdateRepoParamsDto, UpdateRepoRequestDto, UpdateRepoResponseDto } from './dto/update-repo.dto';
import { AddRepoUsecase } from './usecase/add-repo.usecase';
import { ListAvailableReposUsecase } from './usecase/list-available-repos.usecase';
import { ListReposUsecase } from './usecase/list-repos.usecase';
import { RemoveRepoUsecase } from './usecase/remove-repo.usecase';
import { UpdateRepoUsecase } from './usecase/update-repo.usecase';

@Controller('repos')
export class ReposController {
  constructor(
    private readonly listAvailableReposUsecase: ListAvailableReposUsecase,
    private readonly listReposUsecase: ListReposUsecase,
    private readonly addRepoUsecase: AddRepoUsecase,
    private readonly updateRepoUsecase: UpdateRepoUsecase,
    private readonly removeRepoUsecase: RemoveRepoUsecase,
  ) {}

  @Get('available')
  @ZodSerializerDto(ListAvailableReposResponseDto)
  @ApiOkResponse({ type: ListAvailableReposResponseDto })
  @ApiBadRequestResponse({ description: 'No GitHub token saved, or GitHub rejected it' })
  listAvailableRepos(@Query() query: ListAvailableReposQueryDto) {
    return this.listAvailableReposUsecase.execute(query);
  }

  @Get()
  @ZodSerializerDto(ListReposResponseDto)
  @ApiOkResponse({ type: ListReposResponseDto })
  listRepos() {
    return this.listReposUsecase.execute();
  }

  @Post()
  @ZodSerializerDto(AddRepoResponseDto)
  @ApiCreatedResponse({ type: AddRepoResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid name, repository archived, or no usable GitHub token' })
  @ApiNotFoundResponse({ description: 'Repository not found, or the token cannot access it' })
  @ApiConflictResponse({ description: 'Already being watched' })
  addRepo(@Body() body: AddRepoRequestDto) {
    return this.addRepoUsecase.execute(body);
  }

  @Patch(':id')
  @ZodSerializerDto(UpdateRepoResponseDto)
  @ApiOkResponse({ type: UpdateRepoResponseDto })
  @ApiNotFoundResponse({ description: 'No such repository' })
  updateRepo(@Param() params: UpdateRepoParamsDto, @Body() body: UpdateRepoRequestDto) {
    return this.updateRepoUsecase.execute(params, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Removed. Its review history is kept.' })
  @ApiNotFoundResponse({ description: 'No such repository' })
  removeRepo(@Param() params: RemoveRepoParamsDto) {
    return this.removeRepoUsecase.execute(params);
  }
}
