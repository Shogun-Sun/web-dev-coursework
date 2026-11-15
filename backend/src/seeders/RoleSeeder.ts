import type { EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';
import Role from '../roles/entities/role.entity';

export class RoleSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    const existingRole = await em.findOne(Role, {
      code: 'admin',
    });

    if (existingRole) {
      return;
    }

    em.create(Role, {
      code: 'admin',
      name: 'Administrator',
      description: 'System administrator',
    });
  }
}
