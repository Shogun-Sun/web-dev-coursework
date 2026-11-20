import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Session } from './entities/session.entity';
import { RefreshToken } from '../auth/refresh-token.entity';
import { SessionsCleanupService } from './sessions.cleanup.service';

@Module({
  imports: [
    MikroOrmModule.forFeature([Session, RefreshToken]),
  ],
  controllers: [SessionsController],
  providers: [SessionsService, SessionsCleanupService],
})
export class SessionsModule {}