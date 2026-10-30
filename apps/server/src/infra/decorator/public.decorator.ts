import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

// Marks a route anyone may call without signing in: health, GitHub's webhook, and the sign-in itself.
export const Public = () => SetMetadata(IS_PUBLIC, true);
