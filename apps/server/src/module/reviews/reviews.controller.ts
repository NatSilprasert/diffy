import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import { CurrentAccountId } from '../../infra/decorator/current-account-id.decorator';
import { CreateReviewRequestDto, CreateReviewResponseDto } from './dto/create-review.dto';
import { GetReviewParamsDto, GetReviewResponseDto } from './dto/get-review.dto';
import { GetReviewStatsResponseDto } from './dto/get-review-stats.dto';
import { GetUsageResponseDto } from './dto/get-usage.dto';
import { GetStatusResponseDto } from './dto/get-status.dto';
import { ListReviewsQueryDto, ListReviewsResponseDto } from './dto/list-reviews.dto';
import { PollRepoRequestDto, PollRepoResponseDto } from './dto/poll-repo.dto';
import { RetryReviewParamsDto, RetryReviewResponseDto } from './dto/retry-review.dto';
import { CreateReviewUsecase } from './usecase/create-review.usecase';
import { GetReviewStatsUsecase } from './usecase/get-review-stats.usecase';
import { GetUsageUsecase } from './usecase/get-usage.usecase';
import { GetReviewUsecase } from './usecase/get-review.usecase';
import { GetStatusUsecase } from './usecase/get-status.usecase';
import { ListReviewsUsecase } from './usecase/list-reviews.usecase';
import { PollRepoUsecase } from './usecase/poll-repo.usecase';
import { RetryReviewUsecase } from './usecase/retry-review.usecase';

@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly createReviewUsecase: CreateReviewUsecase,
    private readonly listReviewsUsecase: ListReviewsUsecase,
    private readonly getReviewUsecase: GetReviewUsecase,
    private readonly retryReviewUsecase: RetryReviewUsecase,
    private readonly pollRepoUsecase: PollRepoUsecase,
    private readonly getStatusUsecase: GetStatusUsecase,
    private readonly getReviewStatsUsecase: GetReviewStatsUsecase,
    private readonly getUsageUsecase: GetUsageUsecase,
  ) {}

  @Post()
  @ZodSerializerDto(CreateReviewResponseDto)
  @ApiCreatedResponse({ type: CreateReviewResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid body, or no usable GitHub token' })
  @ApiNotFoundResponse({ description: 'Unknown repository, or pull request not found' })
  createReview(@CurrentAccountId() accountId: string, @Body() body: CreateReviewRequestDto) {
    return this.createReviewUsecase.execute(accountId, body);
  }

  @Get()
  @ZodSerializerDto(ListReviewsResponseDto)
  @ApiOkResponse({ type: ListReviewsResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid filter, cursor or limit' })
  listReviews(@CurrentAccountId() accountId: string, @Query() query: ListReviewsQueryDto) {
    return this.listReviewsUsecase.execute(accountId, query);
  }

  // Declared before ':id' on purpose, otherwise "stats" and "status" would be read as review ids.
  // Tokens and review counts by model and by repository, and reviews per day, for the dashboard.
  @Get('usage')
  @ZodSerializerDto(GetUsageResponseDto)
  @ApiOkResponse({ type: GetUsageResponseDto })
  getUsage(@CurrentAccountId() accountId: string) {
    return this.getUsageUsecase.execute(accountId);
  }

  @Get('stats')
  @ZodSerializerDto(GetReviewStatsResponseDto)
  @ApiOkResponse({ type: GetReviewStatsResponseDto })
  getReviewStats(@CurrentAccountId() accountId: string) {
    return this.getReviewStatsUsecase.execute(accountId);
  }

  @Get('status')
  @ZodSerializerDto(GetStatusResponseDto)
  @ApiOkResponse({ type: GetStatusResponseDto })
  getStatus(@CurrentAccountId() accountId: string) {
    return this.getStatusUsecase.execute(accountId);
  }

  @Get(':id')
  @ZodSerializerDto(GetReviewResponseDto)
  @ApiOkResponse({ type: GetReviewResponseDto })
  @ApiNotFoundResponse({ description: 'No such review' })
  getReview(@CurrentAccountId() accountId: string, @Param() params: GetReviewParamsDto) {
    return this.getReviewUsecase.execute(accountId, params);
  }

  @Post(':id/retry')
  @HttpCode(200)
  @ZodSerializerDto(RetryReviewResponseDto)
  @ApiOkResponse({ type: RetryReviewResponseDto })
  @ApiNotFoundResponse({ description: 'No such review' })
  @ApiConflictResponse({ description: 'The review is queued or running already' })
  retryReview(@CurrentAccountId() accountId: string, @Param() params: RetryReviewParamsDto) {
    return this.retryReviewUsecase.execute(accountId, params);
  }

  // "Check now": looks for new pull requests in one repository straight away, instead of waiting for the timer.
  @Post('poll')
  @HttpCode(200)
  @ZodSerializerDto(PollRepoResponseDto)
  @ApiOkResponse({ type: PollRepoResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid body' })
  @ApiNotFoundResponse({ description: 'No such repository' })
  pollRepo(@CurrentAccountId() accountId: string, @Body() body: PollRepoRequestDto) {
    return this.pollRepoUsecase.execute(accountId, body);
  }
}
