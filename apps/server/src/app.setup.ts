import type { INestApplication } from '@nestjs/common';

// Shared by main.ts and the OpenAPI generator so both see the same routes.
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
}
