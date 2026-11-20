
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from '@mikro-orm/core';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { Session } from './entities/session.entity';
import { RefreshToken } from '../auth/refresh-token.entity';

@Injectable()
export class SessionsCleanupService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SessionsCleanupService.name);
  private readonly jobName = 'sessions-cleanup';

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly em: EntityManager,
  ) {}

  onModuleInit(): void {
    const cronExpression = this.configService.getOrThrow<string>(
      'SESSION_CLEANUP_CRON',
    );

    const job = new CronJob(cronExpression, () => {
      void this.cleanupExpiredSessions().catch((error: unknown) => {
        this.logger.error(
          'Failed to clean up expired sessions',
          error instanceof Error ? error.stack : String(error),
        );
      });
    });

    this.schedulerRegistry.addCronJob(this.jobName, job);
    job.start();

    this.logger.log(
      `Session cleanup scheduled with cron: ${cronExpression}`,
    );
  }

  onModuleDestroy(): void {
    const job = this.schedulerRegistry.getCronJob(this.jobName);

    job.stop();
    this.schedulerRegistry.deleteCronJob(this.jobName);
  }

  async cleanupExpiredSessions(): Promise<number> {
    const retentionDays = this.configService.getOrThrow<number>(
      'SESSION_RETENTION_DAYS',
    );

    const cutoff = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000,
    );

    const deletedCount = await this.em.transactional(
      async (transactionalEm) => {
        const expiredSessions = await transactionalEm.find(
          Session,
          {
            $or: [
              {
                revokedAt: {
                  $lt: cutoff,
                },
              },
              {
                revokedAt: null,
                expiresAt: {
                  $lt: cutoff,
                },
              },
            ],
          },
          {
            fields: ['id'],
          },
        );

        const sessionIds = expiredSessions.map((session) => session.id);

        if (sessionIds.length === 0) {
          return 0;
        }

        await transactionalEm.nativeDelete(RefreshToken, {
          session: {
            id: {
              $in: sessionIds,
            },
          },
        });

        await transactionalEm.nativeDelete(Session, {
          id: {
            $in: sessionIds,
          },
        });

        return sessionIds.length;
      },
    );

    if (deletedCount > 0) {
      this.logger.log(`Deleted ${deletedCount} expired sessions`);
    } else {
      this.logger.log('No expired sessions to delete');
    }

    return deletedCount;
  }
}
