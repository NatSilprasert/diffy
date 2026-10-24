import { Body, Controller, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiCreatedResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import { CreateReviewRequestDto, CreateReviewResponseDto } from './dto/create-review.dto';
import { CreateReviewUsecase } from './usecase/create-review.usecase';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly createReviewUsecase: CreateReviewUsecase) {}

  @Post()
  @ZodSerializerDto(CreateReviewResponseDto)
  @ApiCreatedResponse({ type: CreateReviewResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid body, or no usable GitHub token' })
  @ApiNotFoundResponse({ description: 'Unknown repository, or pull request not found' })
  createReview(@Body() body: CreateReviewRequestDto) {
    return this.createReviewUsecase.execute(body);
  }
}
