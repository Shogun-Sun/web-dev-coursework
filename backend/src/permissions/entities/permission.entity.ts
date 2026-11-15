import {
  Entity,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { randomUUID } from 'node:crypto';

@Entity({ tableName: 'permissions' })
@Unique({ properties: ['code'] })
export class Permission {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ type: 'string', length: 100 })
  code!: string;

  @Property({ type: 'string', length: 100 })
  name!: string;

  @Property({ type: 'text', nullable: true })
  description?: string;

  @Property({ type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date();
}
