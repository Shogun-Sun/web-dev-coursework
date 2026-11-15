import {
  Entity, ManyToMany,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { randomUUID } from 'node:crypto';
import { ManyToOne } from '@mikro-orm/decorators/es';
import Role from '../../roles/entities/role.entity';
import { Collection } from '@mikro-orm/core';

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

  @ManyToMany(() => Role, role => role.users, {owner: true})
  roles = new Collection<Role>(this);
}
