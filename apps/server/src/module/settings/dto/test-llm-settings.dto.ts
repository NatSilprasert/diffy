import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// A failed test is a normal outcome, not a bad request: it comes back as 200 with ok = false.
export const TestLlmSettingsResponseSchema = z.object({
  ok: z.boolean(),
  error: z.string().nullable(),
  latencyMs: z.number().int().nullable(),
});
export class TestLlmSettingsResponseDto extends createZodDto(TestLlmSettingsResponseSchema) {}
