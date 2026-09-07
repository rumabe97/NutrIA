import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import type { INestApplication } from '@nestjs/common';

/**
 * Never mounted in production — the env validation rejects `SWAGGER_ENABLED=true`
 * there. A published schema is a complete map of the attack surface, and this
 * API has no third-party consumers that would justify one.
 */
export function setupSwagger(app: INestApplication, prefix: string): void {
  const config = new DocumentBuilder()
    .setTitle('NutrIA API')
    .setDescription('Planes de nutrición personalizados. Todas las rutas requieren sesión salvo las marcadas como públicas.')
    .setVersion('1.0')
    .addCookieAuth('better-auth.session_token')
    .build();

  SwaggerModule.setup(`${prefix}/docs`, app, SwaggerModule.createDocument(app, config));
}
