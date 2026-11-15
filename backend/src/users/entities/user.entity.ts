import {
  Entity,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { randomUUID } from 'node:crypto';

@Entity({ tableName: 'users' })
@Unique({ properties: ['email'] })
export class User {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ type: 'string', length: 255 })
  email!: string;

  @Property({ type: 'string', length: 255, hidden: true })
  passwordHash!: string;

  @Property({ type: 'string', length: 100 })
  firstName!: string;

  @Property({ type: 'string', length: 100 })
  lastName!: string;

  @Property({ type: 'boolean', default: true })
  isActive: boolean = true;

  @Property({
    type: Date,
    onCreate: () => new Date(),
  })
  createdAt: Date = new Date();

  @Property({
    type: Date,
    onCreate: () => new Date(),
    onUpdate: () => new Date(),
  })
  updatedAt: Date = new Date();
}
