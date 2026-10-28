import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp, enableDevCors } from './app.setup';
import { loadEnv, type Env } from './infra/config/env';
import { buildOpenApiDocument } from './openapi';

async function bootstrap() {
  // Validate before Nest starts so a bad .env prints a short message, not a stack trace.
  let env: Env;
  try {
    env = loadEnv();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  try {
    const app = await NestFactory.create(AppModule, { abortOnError: false, rawBody: true });
    configureApp(app);
    enableDevCors(app);
    SwaggerModule.setup('api/docs', app, buildOpenApiDocument(app));
    await app.listen(env.PORT, env.HOST);
    console.log(`diffy server listening on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

void bootstrap();
