import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy';

@Module({
  imports: [
    MikroOrmModule.forRootAsync({
      driver: PostgreSqlDriver,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        host: config.getOrThrow<string>('DB_HOST'),
        port: config.get<number>('DB_PORT', 5432),

        user: config.getOrThrow<string>('POSTGRES_USER'),
        password: config.getOrThrow<string>('POSTGRES_PASSWORD'),
        dbName: config.getOrThrow<string>('POSTGRES_DB'),

        metadataProvider: ReflectMetadataProvider,

        autoLoadEntities: true,

        debug: config.get<string>('NODE_ENV') === 'development',
      }),
    }),
  ],
  controllers: [],
  providers: [],
})
export class DatabaseModule {}
