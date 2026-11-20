import type { EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';
import { Permission } from '../permissions/entities/permission.entity';

export class PermissionSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    const permissions = [
      {
        code: 'users.read',
        name: 'Просмотр пользователей',
        description: 'Просмотр списка пользователей и их данных',
      },
      {
        code: 'users.create',
        name: 'Создание пользователей',
        description: 'Создание новых пользователей',
      },
      {
        code: 'users.update',
        name: 'Изменение пользователей',
        description: 'Изменение данных пользователей',
      },
      {
        code: 'users.delete',
        name: 'Удаление пользователей',
        description: 'Удаление пользователей',
      },
      {
        code: 'users.roles.manage',
        name: 'Управление ролями пользователей',
        description: 'Назначение и снятие ролей у пользователей',
      },
      {
        code: 'roles.read',
        name: 'Просмотр ролей',
        description: 'Просмотр ролей',
      },
      {
        code: 'roles.create',
        name: 'Создание ролей',
        description: 'Создание новых ролей',
      },
      {
        code: 'roles.update',
        name: 'Изменение ролей',
        description: 'Изменение названия и описания ролей',
      },
      {
        code: 'roles.delete',
        name: 'Удаление ролей',
        description: 'Удаление ролей',
      },
      {
        code: 'roles.permissions.manage',
        name: 'Управление разрешениями ролей',
        description: 'Назначение и снятие permissions у ролей',
      },
      {
        code: 'permissions.read',
        name: 'Просмотр разрешений',
        description: 'Просмотр системных разрешений',
      },
      {
        code: 'permissions.create',
        name: 'Создание разрешений',
        description: 'Создание новых разрешений',
      },
      {
        code: 'permissions.update',
        name: 'Изменение разрешений',
        description: 'Изменение разрешений',
      },
      {
        code: 'permissions.delete',
        name: 'Удаление разрешений',
        description: 'Удаление разрешений',
      },
      {
        code: 'sessions.read',
        name: 'Просмотр сессий',
        description: 'Просмотр сессий пользователей',
      },
      {
        code: 'sessions.revoke',
        name: 'Отзыв сессий',
        description: 'Завершение сессий пользователей',
      },
    ];

    const existingPermissions = await em.find(Permission, {
      code: { $in: permissions.map((permission) => permission.code) },
    });

    const existingCodes = new Set(
      existingPermissions.map((permission) => permission.code),
    );

    const missingPermissions = permissions.filter(
      (permission) => !existingCodes.has(permission.code),
    );

    for (const permission of missingPermissions) {
      const entity = new Permission();

      entity.code = permission.code;
      entity.name = permission.name;
      entity.description = permission.description;

      em.persist(entity);
    }

    await em.flush();

    console.log(
      `PermissionsSeeder: created ${missingPermissions.length} permissions`,
    );
  }
}
