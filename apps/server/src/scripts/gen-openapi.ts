import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from '../app.module';
import { configureApp } from '../app.setup';
import { buildOpenApiDocument } from '../openapi';

// Writes apps/server/openapi.json, the input for the web app's Orval client.
async function main() {
  // preview: true builds the route table without instantiating providers,
  // so this needs no .env and no database.
  const app = await NestFactory.create(AppModule, { preview: true, logger: false });
  configureApp(app);

  const file = resolve(__dirname, '../../openapi.json');
  writeFileSync(file, `${JSON.stringify(buildOpenApiDocument(app), null, 2)}\n`);
  await app.close();
  console.log(`Wrote ${file}`);
}

void main();
