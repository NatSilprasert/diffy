import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ReceiveWebhookResponseSchema = z.object({
  // false for an event diffy has no use for (GitHub still gets a 200, so it does not report a failed delivery).
  handled: z.boolean(),
  event: z.string(),
});
export class ReceiveWebhookResponseDto extends createZodDto(ReceiveWebhookResponseSchema) {}
