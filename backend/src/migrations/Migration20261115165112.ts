import { Migration } from '@mikro-orm/migrations';

export class Migration20261115165112 extends Migration {

  override name = 'Migration20261115165112';

  override up(): void | Promise<void> {
    this.addSql(`create table "permissions" ("id" uuid not null, "code" varchar(100) not null, "name" varchar(100) not null, "description" text null, "created_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`alter table "permissions" add constraint "permissions_code_unique" unique ("code");`);

    this.addSql(`create table "roles" ("id" uuid not null, "code" varchar(100) not null, "name" varchar(100) not null, "description" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`alter table "roles" add constraint "roles_code_unique" unique ("code");`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "permissions" cascade;`);
    this.addSql(`drop table if exists "roles" cascade;`);
  }

}
