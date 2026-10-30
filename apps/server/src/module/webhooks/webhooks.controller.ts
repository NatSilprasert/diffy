import { Body, Controller, Headers, HttpCode, Post, Req, type RawBodyRequest } from '@nestjs/common';
import { ApiOkResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import { Public } from '../../infra/decorator/public.decorator';
import { ReceiveWebhookResponseDto } from './dto/receive-webhook.dto';
import { ReceiveWebhookUsecase } from './usecase/receive-webhook.usecase';

@Controller('github')
export class WebhooksController {
  constructor(private readonly receiveWebhookUsecase: ReceiveWebhookUsecase) {}

  // GitHub calls this itself, so there is no request DTO: the body is whatever GitHub sent, and it is only read
  // after the signature of the raw bytes has been checked.
  @Public()
  @Post('webhook')
  @HttpCode(200)
  @ZodSerializerDto(ReceiveWebhookResponseDto)
  @ApiOkResponse({ type: ReceiveWebhookResponseDto })
  @ApiUnauthorizedResponse({ description: 'The signature does not match' })
  receiveWebhook(
    @Req() req: RawBodyRequest<object>,
    @Headers('x-github-event') event: string | undefined,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() payload: unknown,
  ) {
    return this.receiveWebhookUsecase.execute({ event, signature, rawBody: req.rawBody, payload });
  }
}
