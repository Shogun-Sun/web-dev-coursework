import { Migration } from '@mikro-orm/migrations';

export class Migration20261115170006 extends Migration {

  override name = 'Migration20261115170006';

  override up(): void | Promise<void> {
    this.addSql(`create table "roles_permissions" ("role_id" uuid not null, "permission_id" uuid not null, primary key ("role_id", "permission_id"));`);

    this.addSql(`create table "users_roles" ("user_id" uuid not null, "role_id" uuid not null, primary key ("user_id", "role_id"));`);

    this.addSql(`alter table "roles_permissions" add constraint "roles_permissions_role_id_foreign" foreign key ("role_id") references "roles" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "roles_permissions" add constraint "roles_permissions_permission_id_foreign" foreign key ("permission_id") references "permissions" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "users_roles" add constraint "users_roles_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "users_roles" add constraint "users_roles_role_id_foreign" foreign key ("role_id") references "roles" ("id") on update cascade on delete cascade;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "roles_permissions" cascade;`);
    this.addSql(`drop table if exists "users_roles" cascade;`);
  }

}
