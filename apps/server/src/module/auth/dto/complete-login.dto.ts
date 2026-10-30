import { z } from 'zod';

// What GitHub puts on the address it sends the person back to.
export const CompleteLoginQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});
export type CompleteLoginQuery = z.infer<typeof CompleteLoginQuerySchema>;
