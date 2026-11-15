import {
  Entity,
  ManyToMany,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { randomUUID } from 'node:crypto';
import { User } from '../../users/entities/user.entity';
import { Collection } from '@mikro-orm/core';
import { Permission } from '../../permissions/entities/permission.entity';

@Entity({ tableName: 'roles' })
@Unique({ properties: ['code'] })
export default class Role {
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

  @Property({
    type: Date,
    onCreate: () => new Date(),
    onUpdate: () => new Date(),
  })
  updatedAt: Date = new Date();

  @ManyToMany(() => User, (user) => user.roles)
  users = new Collection<User>(this);

  @ManyToMany(() => Permission, (permission) => permission.roles, {
    owner: true,
  })
  permissions = new Collection<Permission>(this);
}
