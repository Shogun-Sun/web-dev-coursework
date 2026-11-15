import type { EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';
import Role from '../roles/entities/role.entity';
import { User } from '../users/entities/user.entity';
import * as argon2 from 'argon2';

export class AdminSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    const firstName = process.env.ADMIN_FIRST_NAME;
    const lastName = process.env.ADMIN_LAST_NAME;

    if (!email || !password || !firstName || !lastName) {
      throw new Error('Admin environment variables are not configured');
    }

    const adminRole = await em.findOne(Role, { code: 'admin' });

    if (!adminRole) {
      throw new Error('Admin Role not found. Run RoleSeeder first');
    }

    let admin = await em.findOne(User, { email });

    if (!admin) {
      const passwordHash = await argon2.hash(password);
      admin = em.create(User, {
        email,
        passwordHash,
        firstName,
        lastName,
        isActive: true,
      });

      em.persist(admin);
    } else {
      await admin.roles.init();
    }

    if (!admin.roles.contains(adminRole)) {
      admin.roles.add(adminRole);
    }
  }
}
