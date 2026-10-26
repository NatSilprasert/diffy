import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ProfileItemSchema } from './profile-item.schema';

export const MAX_NOTES_CHARS = 10_000;

export const UpdateProfileNotesParamsSchema = z.object({ repositoryId: z.string().min(1) });
export class UpdateProfileNotesParamsDto extends createZodDto(UpdateProfileNotesParamsSchema) {}

export const UpdateProfileNotesRequestSchema = z.object({
  // Replaces the notes. Empty text clears them.
  notes: z.string().max(MAX_NOTES_CHARS),
});
export class UpdateProfileNotesRequestDto extends createZodDto(UpdateProfileNotesRequestSchema) {}

export const UpdateProfileNotesResponseSchema = ProfileItemSchema;
export class UpdateProfileNotesResponseDto extends createZodDto(UpdateProfileNotesResponseSchema) {}
