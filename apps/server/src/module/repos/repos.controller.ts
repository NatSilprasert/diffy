import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import { AddRepoRequestDto, AddRepoResponseDto } from './dto/add-repo.dto';
import { ListAvailableReposQueryDto, ListAvailableReposResponseDto } from './dto/list-available-repos.dto';
import { ListReposResponseDto } from './dto/list-repos.dto';
import { AddRepoUsecase } from './usecase/add-repo.usecase';
import { ListAvailableReposUsecase } from './usecase/list-available-repos.usecase';
import { ListReposUsecase } from './usecase/list-repos.usecase';

@Controller('repos')
export class ReposController {
  constructor(
    private readonly listAvailableReposUsecase: ListAvailableReposUsecase,
    private readonly listReposUsecase: ListReposUsecase,
    private readonly addRepoUsecase: AddRepoUsecase,
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
}
