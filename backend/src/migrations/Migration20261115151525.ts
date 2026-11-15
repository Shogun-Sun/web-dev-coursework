import { Migration } from '@mikro-orm/migrations';

export class Migration20261115151525 extends Migration {

  override name = 'Migration20261115151525';

  override up(): void | Promise<void> {
    this.addSql(`create table "users" ("id" uuid not null, "email" varchar(255) not null, "password_hash" varchar(255) not null, "first_name" varchar(100) not null, "last_name" varchar(100) not null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`alter table "users" add constraint "users_email_unique" unique ("email");`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "users" cascade;`);
  }

}
