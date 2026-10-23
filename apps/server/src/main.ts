import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv, type Env } from './infra/config/env';

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
    const app = await NestFactory.create(AppModule, { abortOnError: false });
    app.setGlobalPrefix('api');
    await app.listen(env.PORT, env.HOST);
    console.log(`Diffy server listening on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

void bootstrap();
