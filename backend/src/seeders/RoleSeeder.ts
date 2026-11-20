import type { EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';
import Role from '../roles/entities/role.entity';
import { Permission } from '../permissions/entities/permission.entity';

export class RoleSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    let adminRole = await em.findOne(Role, {
      code: 'admin',
    });

    if (!adminRole) {
      adminRole = em.create(Role, {
        code: 'admin',
        name: 'Administrator',
        description: 'System administrator',
      });

      em.persist(adminRole);
    } else {
      await adminRole.permissions.init();
    }

    const permissions = await em.find(Permission, {});

    const existingPermissionIds = new Set(
      adminRole.permissions.getItems().map((permission) => permission.id),
    );

    const missingPermissions = permissions.filter(
      (permission) => !existingPermissionIds.has(permission.id),
    );

    for (const permission of missingPermissions) {
      adminRole.permissions.add(permission);
    }

    await em.flush();

    console.log(
      `RoleSeeder: assigned ${missingPermissions.length} permissions to admin`,
    );
  }
}
