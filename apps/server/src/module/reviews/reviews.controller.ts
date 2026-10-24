import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse } from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import { CreateReviewRequestDto, CreateReviewResponseDto } from './dto/create-review.dto';
import { GetReviewParamsDto, GetReviewResponseDto } from './dto/get-review.dto';
import { ListReviewsQueryDto, ListReviewsResponseDto } from './dto/list-reviews.dto';
import { CreateReviewUsecase } from './usecase/create-review.usecase';
import { GetReviewUsecase } from './usecase/get-review.usecase';
import { ListReviewsUsecase } from './usecase/list-reviews.usecase';

@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly createReviewUsecase: CreateReviewUsecase,
    private readonly listReviewsUsecase: ListReviewsUsecase,
    private readonly getReviewUsecase: GetReviewUsecase,
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

  @Get(':id')
  @ZodSerializerDto(GetReviewResponseDto)
  @ApiOkResponse({ type: GetReviewResponseDto })
  @ApiNotFoundResponse({ description: 'No such review' })
  getReview(@Param() params: GetReviewParamsDto) {
    return this.getReviewUsecase.execute(params);
  }
}
