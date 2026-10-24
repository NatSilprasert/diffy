import type { INestApplication } from '@nestjs/common';

// The web app's dev server (`next dev`, port 3000). The same hostname can be spelled two ways.
export const DEV_WEB_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

// Shared by main.ts and the OpenAPI generator so both see the same routes.
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
}

// In development the web app runs on its own port, so the browser needs CORS to call the API.
// In production the API serves the web app itself (same origin) and CORS stays off. It is only ever
// opened for the dev origins above, never for "*": there is no login in v1, and any other web page
// in the user's browser must not be able to call an API that holds their GitHub token.
export function enableDevCors(app: INestApplication) {
  if (process.env.NODE_ENV === 'production') return;
  app.enableCors({ origin: DEV_WEB_ORIGINS });
}
