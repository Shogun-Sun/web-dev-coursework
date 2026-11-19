
import {
    Entity,
    ManyToOne,
    PrimaryKey,
    Property,
} from '@mikro-orm/decorators/legacy';
import { OptionalProps } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';
import { Session } from "../sessions/entities/session.entity";

@Entity({ tableName: 'refresh_tokens' })
export class RefreshToken {
    [OptionalProps]?: 'createdAt' | 'revokedAt';

    @PrimaryKey({ type: 'uuid' })
    id: string = randomUUID();

    @ManyToOne(() => Session)
    session!: Session;

    @Property({ type: 'string', unique: true })
    jti!: string;

    @Property({ type: 'string', hidden: true })
    tokenHash!: string;

    @Property({ type: 'date' })
    expiresAt!: Date;

    @Property({ type: 'date', nullable: true, default: null })
    revokedAt: Date | null = null;

    @Property({ type: 'date', onCreate: () => new Date() })
    createdAt: Date = new Date();
}
