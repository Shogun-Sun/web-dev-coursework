import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

interface SwaggerResponse {
  url?: string;
  status: number;
  body?: unknown;
  obj?: unknown;
}

interface SwaggerRequest {
  url?: string;
  body?: string | Record<string, unknown>;
}

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Coursework API')
    .setDescription('REST API documentation for the coursework project')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT access token',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api-docs.json',
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationSorter: 'alpha',
      responseInterceptor: (response: SwaggerResponse) => {
        const url = response.url ?? '';

        if (
          (url.includes('/auth/login') || url.includes('/auth/refresh')) &&
          response.status >= 200 &&
          response.status < 300
        ) {
          try {
            let rawData: unknown = response.body ?? response.obj;

            if (typeof rawData === 'string') {
              rawData = JSON.parse(rawData);
            }

            const data = rawData as
              | {
                  accessToken?: string;
                  refreshToken?: string;
                }
              | undefined;

            if (data?.refreshToken) {
              (globalThis as any).__swaggerRefreshToken = data.refreshToken;
            }

            if (data?.accessToken) {
              (globalThis as any).ui?.preauthorizeApiKey(
                'access-token',
                data.accessToken,
              );
            }
          } catch {}
        }

        return response;
      },

      requestInterceptor: (request: SwaggerRequest) => {
        if (request.url?.includes('/auth/refresh')) {
          const refreshToken = (globalThis as any).__swaggerRefreshToken;

          if (refreshToken) {
            const body =
              typeof request.body === 'string'
                ? JSON.parse(request.body)
                : (request.body ?? {});

            request.body = JSON.stringify({
              ...body,
              refreshToken,
            });
          }
        }

        return request;
      },
    },
  });
}
