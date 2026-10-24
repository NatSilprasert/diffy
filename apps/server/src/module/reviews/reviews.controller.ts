import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import { CreateReviewRequestDto, CreateReviewResponseDto } from './dto/create-review.dto';
import { GetReviewParamsDto, GetReviewResponseDto } from './dto/get-review.dto';
import { GetStatusResponseDto } from './dto/get-status.dto';
import { ListReviewsQueryDto, ListReviewsResponseDto } from './dto/list-reviews.dto';
import { PollRepoRequestDto, PollRepoResponseDto } from './dto/poll-repo.dto';
import { RetryReviewParamsDto, RetryReviewResponseDto } from './dto/retry-review.dto';
import { CreateReviewUsecase } from './usecase/create-review.usecase';
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
  ) {}

  @Post()
  @ZodSerializerDto(CreateReviewResponseDto)
  @ApiCreatedResponse({ type: CreateReviewResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid body, or no usable GitHub token' })
  @ApiNotFoundResponse({ description: 'Unknown repository, or pull request not found' })
  createReview(@Body() body: CreateReviewRequestDto) {
    return this.createReviewUsecase.execute(body);
  }

  @Get()
  @ZodSerializerDto(ListReviewsResponseDto)
  @ApiOkResponse({ type: ListReviewsResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid filter, cursor or limit' })
  listReviews(@Query() query: ListReviewsQueryDto) {
    return this.listReviewsUsecase.execute(query);
  }

  // Declared before ':id' on purpose, otherwise "status" would be read as a review id.
  @Get('status')
  @ZodSerializerDto(GetStatusResponseDto)
  @ApiOkResponse({ type: GetStatusResponseDto })
  getStatus() {
    return this.getStatusUsecase.execute();
  }

  @Get(':id')
  @ZodSerializerDto(GetReviewResponseDto)
  @ApiOkResponse({ type: GetReviewResponseDto })
  @ApiNotFoundResponse({ description: 'No such review' })
  getReview(@Param() params: GetReviewParamsDto) {
    return this.getReviewUsecase.execute(params);
  }

  @Post(':id/retry')
  @HttpCode(200)
  @ZodSerializerDto(RetryReviewResponseDto)
  @ApiOkResponse({ type: RetryReviewResponseDto })
  @ApiNotFoundResponse({ description: 'No such review' })
  @ApiConflictResponse({ description: 'The review is not in the failed state' })
  retryReview(@Param() params: RetryReviewParamsDto) {
    return this.retryReviewUsecase.execute(params);
  }

  // "Check now": looks for new pull requests in one repository straight away, instead of waiting for the timer.
  @Post('poll')
  @HttpCode(200)
  @ZodSerializerDto(PollRepoResponseDto)
  @ApiOkResponse({ type: PollRepoResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid body' })
  @ApiNotFoundResponse({ description: 'No such repository' })
  pollRepo(@Body() body: PollRepoRequestDto) {
    return this.pollRepoUsecase.execute(body);
  }
}
