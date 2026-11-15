import {
  Entity, ManyToMany,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { randomUUID } from 'node:crypto';
import Role from '../../roles/entities/role.entity';
import { Collection } from '@mikro-orm/core';

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

  @ManyToMany(() => Role, role => role.permissions)
  roles = new Collection<Role>(this)
}
