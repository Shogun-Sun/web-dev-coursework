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
  [OptionalProps]?: 'createdAt' | 'revokedAt';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne(() => User)
  user!: User;

  @Property({ type: 'string', hidden: true })
  tokenHash!: string;

  @Property({ type: 'datetime' })
  expiresAt!: Date;

  @Property({ type: 'datetime', nullable: true })
  revokedAt: Date | null = null;

  @Property({ type: 'datetime', onCreate: () => new Date() })
  createdAt: Date = new Date();
}
