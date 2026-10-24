import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse } from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import { ListAvailableReposQueryDto, ListAvailableReposResponseDto } from './dto/list-available-repos.dto';
import { ListAvailableReposUsecase } from './usecase/list-available-repos.usecase';

@Controller('repos')
export class ReposController {
  constructor(private readonly listAvailableReposUsecase: ListAvailableReposUsecase) {}

  @Get('available')
  @ZodSerializerDto(ListAvailableReposResponseDto)
  @ApiOkResponse({ type: ListAvailableReposResponseDto })
  @ApiBadRequestResponse({ description: 'No GitHub token saved, or GitHub rejected it' })
  listAvailableRepos(@Query() query: ListAvailableReposQueryDto) {
    return this.listAvailableReposUsecase.execute(query);
  }
}
