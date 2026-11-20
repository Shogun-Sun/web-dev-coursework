import {
  Entity,
  PrimaryKey,
  ManyToOne,
  Property,
} from '@mikro-orm/decorators/legacy';
import { randomUUID } from 'node:crypto';
import { User } from '../../users/entities/user.entity';
import { OptionalProps } from '@mikro-orm/core';

@Entity({ tableName: 'sessions' })
export class Session {
  [OptionalProps]?: 'createdAt' | 'revokedAt' | 'ipAddress' | 'userAgent' | 'deviceName' | 'lastActivityAt' ;

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne(() => User)
  user!: User;

  @Property({type: "string", nullable: true})
  ipAddress?: string;

  @Property({type: "string", nullable: true})
  userAgent?: string;

  @Property({type: "string", nullable: true})
  deviceName?: string;

  @Property({type: 'datetime', onCreate: () => new Date(), defaultRaw: 'now()' })
  lastActivityAt: Date = new Date();

  @Property({ type: 'datetime' })
  expiresAt!: Date;

  @Property({ type: 'datetime', nullable: true })
  revokedAt: Date | null = null;

  @Property({ type: 'datetime', onCreate: () => new Date() })
  createdAt: Date = new Date();
}
