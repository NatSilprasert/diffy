import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

export function buildOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder().setTitle('Diffy API').setVersion('0.0.0').build();
  const document = SwaggerModule.createDocument(app, config, {
    // The controller method name becomes the operationId, which Orval turns into hook names
    // (getHealth -> useGetHealth).
    operationIdFactory: (_controllerKey, methodKey) => methodKey,
  });
  return cleanupOpenApiDoc(document);
}
